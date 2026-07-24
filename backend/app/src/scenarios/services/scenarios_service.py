import json
import math
import random
import re

from fastapi import HTTPException

from configs.logger import logger
from configs.llm_integration import llm_integration
from src.archs.repositories import archs_repository
from src.constants.prompts import CAPACITY_ANALYZER, TRAFFIC_PROFILER
from src.scenarios.models.scenario_model import SimNode, SimResult, SimScenario, TrafficProfile
from src.scenarios.repositories.scenarios_repository import scenarios_repository
from src.scenarios.schemas.scenarios_schema import CreateScenario, UpdateScenario
from src.usage.repositories.usage_repository import usage_repository


# ─── JSON helpers ─────────────────────────────────────────────────────────────

def _extract_json(content: str) -> dict:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content)
    if match:
        return json.loads(match.group(1).strip())
    return json.loads(content.strip())


# ─── Mock fallback ────────────────────────────────────────────────────────────

def _guess_metric(label: str) -> tuple[str, float]:
    l = label.lower()
    if re.search(r"db|database|rds|sql|postgres|mysql|mongo", l):
        return "QPS", random.uniform(500, 2000)
    if re.search(r"cache|redis|memcache", l):
        return "Ops/s", random.uniform(10000, 50000)
    if re.search(r"queue|kafka|sqs|rabbit|pubsub|mqtt", l):
        return "msg/s", random.uniform(5000, 20000)
    if re.search(r"lb|load.?balancer|gateway|nginx", l):
        return "RPS", random.uniform(5000, 13000)
    return "RPS", random.uniform(500, 3500)


def _build_mock_sim_result(canvas_nodes: list, traffic_profile: "TrafficProfile | None" = None) -> SimResult:
    node_capacities = []
    for n in canvas_nodes:
        label = n.custom_label or n.label
        metric, capacity = _guess_metric(label)
        node_capacities.append(SimNode(
            canvas_node_id=n.id,
            label=label,
            icon=n.icon or "",
            metric=metric,
            capacity=round(capacity),
            utilization=0,
        ))

    if not node_capacities:
        return SimResult(scenarios=[
            SimScenario(name="Best",  entry_traffic=0, nodes=[]),
            SimScenario(name="Mid",   entry_traffic=0, nodes=[]),
            SimScenario(name="Worst", entry_traffic=0, nodes=[]),
        ])

    if traffic_profile:
        tiers = [
            ("Best",  traffic_profile.best),
            ("Mid",   traffic_profile.mid),
            ("Worst", traffic_profile.worst),
        ]
    else:
        min_cap = min(n.capacity for n in node_capacities)
        tiers = [
            ("Best",  round(min_cap * 0.15)),
            ("Mid",   round(min_cap * 0.60)),
            ("Worst", round(min_cap * 1.40)),
        ]

    def build_scenario(name: str, entry_traffic: float) -> SimScenario:
        nodes = [
            SimNode(
                **{**n.model_dump(), "utilization": min(
                    999,
                    round((entry_traffic / n.capacity) * 100 * random.uniform(0.85, 1.15)),
                )}
            )
            for n in node_capacities
        ]
        return SimScenario(name=name, entry_traffic=entry_traffic, nodes=nodes)

    return SimResult(scenarios=[build_scenario(name, traffic) for name, traffic in tiers])


# ─── Traffic profiler ─────────────────────────────────────────────────────────

def _call_traffic_profiler(name: str, description: str) -> tuple["TrafficProfile | None", object]:
    """Calls TRAFFIC_PROFILER LLM. Returns (TrafficProfile | None, raw_response | None)."""
    user_msg = (
        f"SCENARIO NAME: {name}\n"
        f"SCENARIO DESCRIPTION: {description or 'No description provided.'}"
    )
    response = llm_integration.query_llm([
        {"role": "system", "content": TRAFFIC_PROFILER},
        {"role": "user",   "content": user_msg},
    ])
    if not response or not response.choices:
        return None, response
    content = response.choices[0].message.content or ""
    try:
        raw = _extract_json(content)
        profile = TrafficProfile(
            traffic_unit=raw.get("traffic_unit", "RPS"),
            best=float(raw.get("best", 1000)),
            mid=float(raw.get("mid", 5000)),
            worst=float(raw.get("worst", 15000)),
        )
        return profile, response
    except Exception as e:
        logger.warning(f"Failed to parse traffic profiler response: {e}")
        return None, response


# ─── Phase 1: capacity prompt ─────────────────────────────────────────────────

def _build_capacity_message(canvas_nodes: list) -> str:
    lines = [f"ARCHITECTURE COMPONENTS ({len(canvas_nodes)} total):"]
    for n in canvas_nodes:
        label = n.custom_label or n.label
        parts = [f"canvas_node_id: {n.id}", f"label: {label}"]
        if n.description:
            parts.append(f"description: {n.description}")
        if n.provider:
            parts.append(f"provider: {n.provider}")
        if n.configs:
            config_pairs = [
                f"{c.get('key')}={c.get('value')}"
                for c in n.configs
                if c.get("key") and c.get("value") is not None
            ]
            if config_pairs:
                parts.append(f"configs: {', '.join(config_pairs)}")
        lines.append("  - " + " | ".join(parts))
    lines += ["", "Return ONLY the JSON object. No markdown fences, no explanation."]
    return "\n".join(lines)


def _parse_capacities(raw: dict) -> dict[str, dict]:
    """Returns {canvas_node_id: {metric, capacity, label, reason}}."""
    result = {}
    for n in raw.get("nodes", []):
        node_id = n.get("canvas_node_id")
        if node_id:
            # Use `or 1000` so that 0, None, and missing all fall back to the default
            raw_cap = n.get("capacity") or 1000
            result[node_id] = {
                "label":    n.get("label", ""),
                "metric":   n.get("metric", "RPS"),
                "capacity": max(1.0, float(raw_cap)),
                "reason":   n.get("reason", ""),
            }
    return result


def _utilization_note(util: float) -> str:
    if util <= 30:
        return "well within safe limits"
    if util <= 60:
        return "moderate load, healthy headroom"
    if util <= 80:
        return "approaching high utilization — monitor closely"
    if util <= 100:
        return "near saturation — latency spikes likely"
    if util <= 150:
        return "overloaded — expect request queuing and degraded latency"
    return "severely overloaded — service failures likely"


# ─── Pure-math sim result builder ─────────────────────────────────────────────

def _build_sim_result_from_traffic(
    traffic_profile: TrafficProfile,
    capacities: dict[str, dict],
    icon_map: dict[str, str],
    canvas_nodes: list,
) -> SimResult:
    """Pure math: utilization = entry_traffic / node_capacity × 100.

    No LLM reasoning about traffic propagation — every node is evaluated
    against the full scenario entry_traffic so bottlenecks are visible immediately.
    """
    tiers = [
        ("Best",  traffic_profile.best),
        ("Mid",   traffic_profile.mid),
        ("Worst", traffic_profile.worst),
    ]
    scenarios = []
    for tier_name, entry_traffic in tiers:
        nodes = []
        for arch_node in canvas_nodes:
            node_id        = arch_node.id
            cap            = capacities.get(node_id, {})
            capacity       = max(1.0, cap.get("capacity", 1000.0))
            util           = min(999.0, round(entry_traffic / capacity * 100, 1)) if capacity else 999.0
            capacity_reason = cap.get("reason", "")
            util_note      = _utilization_note(util)
            reason = (
                f"{capacity_reason} "
                f"[{tier_name}: {entry_traffic:,.0f} {traffic_profile.traffic_unit} → "
                f"{util:.0f}% — {util_note}.]"
            ).strip()
            nodes.append(SimNode(
                canvas_node_id=node_id,
                label=cap.get("label", arch_node.custom_label or arch_node.label),
                icon=icon_map.get(node_id, arch_node.icon or ""),
                metric=cap.get("metric", "RPS"),
                capacity=capacity,
                utilization=util,
                reason=reason,
            ))
        scenarios.append(SimScenario(name=tier_name, entry_traffic=entry_traffic, nodes=nodes))
    return SimResult(scenarios=scenarios)


# ─── Serialiser ───────────────────────────────────────────────────────────────

def _serialize(scenario) -> dict:
    return json.loads(scenario.model_dump_json())


# ─── Service ──────────────────────────────────────────────────────────────────

class ScenariosService:

    async def create(self, arch_id: str, data: CreateScenario) -> dict:
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Architecture not found.")
        scenario = await scenarios_repository.create(arch_id, data)

        profile, response = _call_traffic_profiler(scenario.name, scenario.description)
        if profile:
            scenario = await scenarios_repository.save_traffic_profile(str(scenario.id), profile)
            logger.info(f"Traffic profile generated for new scenario {scenario.id}")
        if response and response.usage and profile:
            await usage_repository.create(
                arch_id=arch_id,
                model=response.model,
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens,
            )

        return _serialize(scenario)

    async def list_by_arch(self, arch_id: str, page: int, limit: int) -> dict:
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Architecture not found.")
        items, total = await scenarios_repository.list_by_arch(arch_id, page, limit)
        pages = math.ceil(total / limit) if total > 0 else 0
        return {
            "items": [_serialize(s) for s in items],
            "total": total,
            "page":  page,
            "limit": limit,
            "pages": pages,
        }

    async def get(self, arch_id: str, scenario_id: str) -> dict:
        scenario = await scenarios_repository.get(scenario_id)
        if not scenario or scenario.arch_id != arch_id:
            raise HTTPException(status_code=404, detail="Scenario not found.")
        return _serialize(scenario)

    async def update(self, arch_id: str, scenario_id: str, data: UpdateScenario) -> dict:
        scenario = await scenarios_repository.get(scenario_id)
        if not scenario or scenario.arch_id != arch_id:
            raise HTTPException(status_code=404, detail="Scenario not found.")
        updated = await scenarios_repository.update(scenario_id, data)

        # Re-generate traffic profile only when the scenario text changes
        if data.name is not None or data.description is not None:
            new_name = data.name if data.name is not None else updated.name
            new_desc = data.description if data.description is not None else updated.description
            profile, response = _call_traffic_profiler(new_name, new_desc)
            if profile:
                updated = await scenarios_repository.save_traffic_profile(scenario_id, profile)
                logger.info(f"Traffic profile regenerated for scenario {scenario_id}")
            if response and response.usage and profile:
                await usage_repository.create(
                    arch_id=arch_id,
                    model=response.model,
                    prompt_tokens=response.usage.prompt_tokens,
                    completion_tokens=response.usage.completion_tokens,
                    total_tokens=response.usage.total_tokens,
                )

        return _serialize(updated)

    async def generate(self, arch_id: str, scenario_id: str) -> dict:
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Architecture not found.")
        scenario = await scenarios_repository.get(scenario_id)
        if not scenario or scenario.arch_id != arch_id:
            raise HTTPException(status_code=404, detail="Scenario not found.")

        canvas_nodes = [n for n in arch.nodes if (n.node_type or "archNode") == "archNode"]
        if not canvas_nodes:
            raise HTTPException(
                status_code=422,
                detail="No architecture components found. Add nodes to the canvas first.",
            )

        icon_map = {n.id: (n.icon or "") for n in canvas_nodes}

        # Ensure traffic_profile exists — generate on demand if missing (e.g. migrated scenarios)
        traffic_profile = scenario.traffic_profile
        profile_response = None
        if not traffic_profile:
            traffic_profile, profile_response = _call_traffic_profiler(scenario.name, scenario.description)
            if traffic_profile:
                await scenarios_repository.save_traffic_profile(scenario_id, traffic_profile)
                logger.info(f"Traffic profile auto-generated during generate() for scenario {scenario_id}")

        # Phase 1: Capacity — always fresh from architecture, no scenario context
        capacities: dict[str, dict] = {}
        capacity_response = llm_integration.query_llm([
            {"role": "system", "content": CAPACITY_ANALYZER},
            {"role": "user",   "content": _build_capacity_message(canvas_nodes)},
        ])
        if capacity_response and capacity_response.choices:
            content = capacity_response.choices[0].message.content or ""
            try:
                capacities = _parse_capacities(_extract_json(content))
                logger.info(f"Capacity analysis done for scenario {scenario_id}: {len(capacities)} nodes")
            except Exception as e:
                logger.warning(f"Failed to parse capacity response for scenario {scenario_id}: {e}")

        # Pure math: utilization = entry_traffic / capacity × 100 — no LLM for this step
        if traffic_profile and capacities:
            sim_result = _build_sim_result_from_traffic(traffic_profile, capacities, icon_map, canvas_nodes)
        else:
            logger.info(f"Falling back to mock sim result for scenario {scenario_id}")
            sim_result = _build_mock_sim_result(canvas_nodes, traffic_profile)

        # Track usage for both LLM calls
        calls = [r for r in [profile_response, capacity_response] if r and r.usage]
        if calls:
            total_prompt = sum(r.usage.prompt_tokens for r in calls)
            total_completion = sum(r.usage.completion_tokens for r in calls)
            total_tokens = sum(r.usage.total_tokens for r in calls)
            model_used = next((r.model for r in calls if r.model), None)
            if model_used:
                await usage_repository.create(
                    arch_id=arch_id,
                    model=model_used,
                    prompt_tokens=total_prompt,
                    completion_tokens=total_completion,
                    total_tokens=total_tokens,
                )

        updated = await scenarios_repository.save_sim_result(scenario_id, sim_result)
        return _serialize(updated)

    async def delete(self, arch_id: str, scenario_id: str) -> None:
        scenario = await scenarios_repository.get(scenario_id)
        if not scenario or scenario.arch_id != arch_id:
            raise HTTPException(status_code=404, detail="Scenario not found.")
        await scenarios_repository.delete(scenario_id)


scenarios_service = ScenariosService()
