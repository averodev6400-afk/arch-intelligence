from datetime import datetime, timezone
from typing import Literal, Optional

from beanie import Document
from pydantic import BaseModel, Field


class EntryPoint(BaseModel):
    node_id: str
    traffic_unit: str = "RPS"


class SimNode(BaseModel):
    canvas_node_id: str
    label: str
    icon: str
    metric: str
    capacity: float
    utilization: float
    reason: str = ""


class SimScenario(BaseModel):
    name: Literal["Best", "Mid", "Worst"]
    entry_traffic: float
    nodes: list[SimNode]


class SimResult(BaseModel):
    scenarios: list[SimScenario]  # always ordered [Best, Mid, Worst]


class TrafficProfile(BaseModel):
    traffic_unit: str = "RPS"
    best: float
    mid: float
    worst: float


class NodeOverride(BaseModel):
    capacity: Optional[float] = None
    metric: Optional[str] = None


class Scenario(Document):
    arch_id: str
    name: str
    description: str = ""
    entry_point: Optional[EntryPoint] = None
    traffic_profile: Optional[TrafficProfile] = None
    sim_result: Optional[SimResult] = None
    overrides: dict[str, NodeOverride] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "scenarios"
