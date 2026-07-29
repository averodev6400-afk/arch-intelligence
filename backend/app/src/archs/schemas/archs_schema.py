from pydantic import BaseModel, Field
from typing import Optional

class PositionSchema(BaseModel):
    x: float
    y: float


class ArchNodeSchema(BaseModel):
    """Full node details as placed on the canvas."""
    id: str
    label: str
    custom_label: Optional[str] = None  # user-defined name in context of this architecture
    icon: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    position: PositionSchema
    node_type: Optional[str] = None
    configs: Optional[list[dict]] = None
    parent_id: Optional[str] = None  # references another node's id for grouping
    width: Optional[float] = None
    height: Optional[float] = None
    color_theme: Optional[str] = None
    font_size: Optional[int] = None

class EdgeSchema(BaseModel):
    id: Optional[str] = None
    source: str
    target: str
    source_handle: Optional[str] = None
    target_handle: Optional[str] = None
    label: Optional[str] = None
    description: Optional[str] = None

class CreateArch(BaseModel):
    name: str
    description: str
    nodes: list[ArchNodeSchema] = Field(default_factory=list)
    edges: list[EdgeSchema] = Field(default_factory=list)

class UpdateArch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[list[ArchNodeSchema]] = None
    edges: Optional[list[EdgeSchema]] = None

class Arch(BaseModel):
    id: str
    name: str
    description: str
    nodes: list[ArchNodeSchema] = Field(default_factory=list)
    edges: list[EdgeSchema] = Field(default_factory=list)

class ArchListResponse(BaseModel):
    items: list[Arch]
    total: int
    page: int
    limit: int
    pages: int
