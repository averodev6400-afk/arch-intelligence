import json
import math
from typing import Optional

from fastapi import HTTPException
from src.nodes.repositories import nodes_repository


class NodeService:
    """
    Service class for handling business logic related to Nodes. It interacts with the NodesRepository for database operations.
    """
    async def create_node(self, node_data):
        """
        Service method to create a new node. It calls the repository method to handle database operations.
        """
        node_details = await nodes_repository.create_node(node_data)
        node = json.loads(node_details.model_dump_json())
        return node

    async def list_nodes(self, page: int, limit: int, search: Optional[str] = None, node_type: Optional[str] = None):
        nodes, total = await nodes_repository.list_nodes(page, limit, search, node_type)
        items = [json.loads(n.model_dump_json()) for n in nodes]
        pages = math.ceil(total / limit) if total > 0 else 0
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    async def delete_node(self, node_id: str) -> None:
        deleted = await nodes_repository.delete_node(node_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Node not found.")

    async def update_node(self, node_id: str, update_data) -> dict:
        node = await nodes_repository.update_node(node_id, update_data)
        if not node:
            raise HTTPException(status_code=404, detail="Node not found.")
        return json.loads(node.model_dump_json())

nodes_service = NodeService()