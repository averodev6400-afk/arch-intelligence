from datetime import datetime, timezone
from beanie import Document
from typing import Optional
from pydantic import BaseModel, Field


class Position(BaseModel):
    x: float
    y: float


class ArchNodeData(BaseModel):
    """Stores full node details as placed on the canvas."""
    id: str  # ReactFlow node ID
    label: str
    custom_label: Optional[str] = None  # user-defined name in context of this architecture
    icon: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    position: Position
    node_type: Optional[str] = None  # ReactFlow node type e.g. 'archNode', 'groupNode'
    configs: Optional[list[dict]] = None
    parent_id: Optional[str] = None  # references another ArchNodeData.id for grouping
    width: Optional[float] = None
    height: Optional[float] = None
    color_theme: Optional[str] = None
    font_size: Optional[int] = None


class Edge(BaseModel):
    id: Optional[str] = None  # ReactFlow edge ID
    source: str  # source node ID
    target: str  # target node ID
    source_handle: Optional[str] = None  # handle ID on source node
    target_handle: Optional[str] = None  # handle ID on target node
    label: Optional[str] = None
    description: Optional[str] = None


class Arch(Document):
    name: str
    description: str
    nodes: list[ArchNodeData] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "archs"
