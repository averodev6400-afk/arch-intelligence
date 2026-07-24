from typing import Literal, Optional
from pydantic import BaseModel


class EntryPointSchema(BaseModel):
    node_id: str
    traffic_unit: str = "RPS"


class NodeOverrideSchema(BaseModel):
    capacity: Optional[float] = None
    metric: Optional[str] = None


class SimNodeSchema(BaseModel):
    canvas_node_id: str
    label: str
    icon: str
    metric: str
    capacity: float
    utilization: float
    reason: str = ""


class SimScenarioSchema(BaseModel):
    name: Literal["Best", "Mid", "Worst"]
    entry_traffic: float
    nodes: list[SimNodeSchema]


class SimResultSchema(BaseModel):
    scenarios: list[SimScenarioSchema]


class TrafficProfileSchema(BaseModel):
    traffic_unit: str
    best: float
    mid: float
    worst: float


# ─── Request schemas ──────────────────────────────────────────────────────────

class CreateScenario(BaseModel):
    name: str
    description: str = ""
    entry_point: Optional[EntryPointSchema] = None


class UpdateScenario(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    entry_point: Optional[EntryPointSchema] = None
    overrides: Optional[dict[str, NodeOverrideSchema]] = None


# ─── Response schemas ─────────────────────────────────────────────────────────

class ScenarioResponse(BaseModel):
    id: str
    arch_id: str
    name: str
    description: str
    entry_point: Optional[EntryPointSchema]
    traffic_profile: Optional[TrafficProfileSchema]
    sim_result: Optional[SimResultSchema]
    overrides: dict[str, NodeOverrideSchema]
    created_at: str
    updated_at: str


class ScenarioListResponse(BaseModel):
    items: list[ScenarioResponse]
    total: int
    page: int
    limit: int
    pages: int
