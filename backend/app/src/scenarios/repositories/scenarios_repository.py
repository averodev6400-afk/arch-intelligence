from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId

from src.scenarios.models.scenario_model import NodeOverride, Scenario, SimResult, TrafficProfile
from src.scenarios.schemas.scenarios_schema import CreateScenario, UpdateScenario


class ScenariosRepository:

    async def create(self, arch_id: str, data: CreateScenario) -> Scenario:
        scenario = Scenario(arch_id=arch_id, **data.model_dump())
        return await scenario.insert()

    async def list_by_arch(self, arch_id: str, page: int, limit: int) -> tuple[list[Scenario], int]:
        skip = (page - 1) * limit
        query = Scenario.find(Scenario.arch_id == arch_id)
        total = await query.count()
        items = await query.sort(-Scenario.created_at).skip(skip).limit(limit).to_list()
        return items, total

    async def get(self, scenario_id: str) -> Optional[Scenario]:
        return await Scenario.get(PydanticObjectId(scenario_id))

    async def update(self, scenario_id: str, data: UpdateScenario) -> Optional[Scenario]:
        scenario = await Scenario.get(PydanticObjectId(scenario_id))
        if not scenario:
            return None
        update_dict = data.model_dump(exclude_unset=True)
        if "overrides" in update_dict and update_dict["overrides"] is not None:
            update_dict["overrides"] = {
                k: NodeOverride(**v) if isinstance(v, dict) else v
                for k, v in update_dict["overrides"].items()
            }
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await scenario.set(update_dict)
        return scenario

    async def save_traffic_profile(self, scenario_id: str, traffic_profile: TrafficProfile) -> Optional[Scenario]:
        scenario = await Scenario.get(PydanticObjectId(scenario_id))
        if not scenario:
            return None
        await scenario.set({"traffic_profile": traffic_profile, "updated_at": datetime.now(timezone.utc)})
        return scenario

    async def save_sim_result(self, scenario_id: str, sim_result: SimResult) -> Optional[Scenario]:
        scenario = await Scenario.get(PydanticObjectId(scenario_id))
        if not scenario:
            return None
        await scenario.set({"sim_result": sim_result, "updated_at": datetime.now(timezone.utc)})
        return scenario

    async def delete(self, scenario_id: str) -> bool:
        scenario = await Scenario.get(PydanticObjectId(scenario_id))
        if not scenario:
            return False
        await scenario.delete()
        return True

    async def delete_by_arch(self, arch_id: str) -> None:
        await Scenario.find(Scenario.arch_id == arch_id).delete()


scenarios_repository = ScenariosRepository()
