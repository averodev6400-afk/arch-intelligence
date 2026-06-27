from pydantic import BaseModel, Field
from typing import Optional

class CreateNode(BaseModel):
    """
    Node schema for creating a new node.
    """
    label: str
    icon: str
    description: str
    provider: str
    node_type: str = "standard"  # "standard" | "group"
    configs: Optional[list[dict]] = []

class Node(BaseModel):
    """
    Node schema for representing a node in the system.
    """
    id: str
    label: str
    icon: str
    description: str
    provider: str
    node_type: str = "standard"
    configs: Optional[list[dict]] = []

class UpdateNode(BaseModel):
    """
    Node schema for updating an existing node. All fields are optional.
    """
    label: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    node_type: Optional[str] = None

class NodeListResponse(BaseModel):
    """
    Paginated response schema for listing nodes.
    """
    items: list[Node]
    total: int
    page: int
    limit: int
    pages: int