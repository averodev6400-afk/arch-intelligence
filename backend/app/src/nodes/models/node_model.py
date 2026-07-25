from datetime import datetime, timezone
from beanie import Document
from typing import Optional
from pydantic import Field

class Node(Document):
    label: str
    icon: Optional[str] = None
    description: str
    provider: str
    node_type: str = "standard"  # "standard" | "group"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # use to store values dynamically for different nodes, e.g. for a vector database node, it can store the collection name, for a llm node, it can store the model name etc.
    configs: Optional[list[dict]] = None

    class Settings:
        name = "nodes"

