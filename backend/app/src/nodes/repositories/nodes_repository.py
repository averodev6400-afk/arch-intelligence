import re
from typing import Optional
from beanie import PydanticObjectId
from beanie.operators import Or, RegEx
from src.nodes.models.node_model import Node
from src.nodes.schemas import CreateNode, UpdateNode

class NodesRepository:
    """
    Repository class for handling database operations related to Nodes.
    """
    async def create_node(self, node_data: CreateNode) -> Node:
        return await Node(**node_data.model_dump()).insert()

    async def list_nodes(self, page: int, limit: int, search: Optional[str] = None, node_type: Optional[str] = None) -> tuple[list, int]:
        skip = (page - 1) * limit
        filters = []

        if search:
            pattern = re.compile(re.escape(search), re.IGNORECASE)
            filters.append(Or(RegEx(Node.label, pattern), RegEx(Node.description, pattern), RegEx(Node.provider, pattern)))

        if node_type:
            filters.append(Node.node_type == node_type)

        query = Node.find(*filters) if filters else Node.find()
        total = await query.count()
        nodes = await query.sort(-Node.created_at).skip(skip).limit(limit).to_list()
        return (nodes, total)

    async def delete_node(self, node_id: str) -> bool:
        node = await Node.get(PydanticObjectId(node_id))
        if not node:
            return False
        await node.delete()
        return True

    async def update_node(self, node_id: str, update_data: UpdateNode) -> Optional[Node]:
        from datetime import datetime, timezone
        node = await Node.get(PydanticObjectId(node_id))
        if not node:
            return None
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await node.set(update_dict)
        return node

nodes_repository = NodesRepository()