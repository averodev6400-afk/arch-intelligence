from typing import Optional
from fastapi import APIRouter, Query
from src.nodes.schemas import CreateNode, UpdateNode, Node, NodeListResponse
from src.nodes.services import nodes_service
from configs.response import SuccessResponse, ErrorResponse

router = APIRouter(
    prefix="/nodes",
    tags=["Nodes"],
)

@router.get(
    path="/",
    summary="List nodes",
    description="Retrieve a paginated list of nodes in descending order. Supports searching by label, description, and provider.",
    responses={
        200: {"description": "Nodes retrieved successfully.", "model": SuccessResponse[NodeListResponse]},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def list_nodes(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Records per page (max 100)"),
    search: Optional[str] = Query(default=None, description="Search term for label, description, or provider"),
    node_type: Optional[str] = Query(default=None, description="Filter by node type: 'standard' or 'group'"),
):
    result = await nodes_service.list_nodes(page, limit, search, node_type)
    return {"success": True, "data": result, "message": "Nodes retrieved successfully."}

@router.post(
    path="/",
    summary="Create a new node",
    description="Create a new node with the provided details.",
    responses={
        200: {
            "description": "Node created successfully.",
            "model": SuccessResponse[Node]
        },
        400: {
            "description": "Invalid input data.",
            "model": ErrorResponse
        },
        422: {
            "description": "Validation error.",
            "model": ErrorResponse
        },
        500: {
            "description": "Internal server error.",
            "model": ErrorResponse
        }
    },
)
async def create_node(
    payload: CreateNode
):
    node = await nodes_service.create_node(payload)
    return {
        "success": True,
        "data": node,
        "message": "Node created successfully."
    }

@router.patch(
    path="/{node_id}",
    summary="Update a node",
    description="Update an existing node's details by its ID. configs and id cannot be updated.",
    responses={
        200: {"description": "Node updated successfully.", "model": SuccessResponse[Node]},
        404: {"description": "Node not found.", "model": ErrorResponse},
        422: {"description": "Validation error.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def update_node(node_id: str, payload: UpdateNode):
    node = await nodes_service.update_node(node_id, payload)
    return {"success": True, "data": node, "message": "Node updated successfully."}

@router.delete(
    path="/{node_id}",
    summary="Delete a node",
    description="Delete a node by its ID.",
    responses={
        200: {"description": "Node deleted successfully.", "model": SuccessResponse},
        404: {"description": "Node not found.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def delete_node(node_id: str):
    await nodes_service.delete_node(node_id)
    return {"success": True, "data": None, "message": "Node deleted successfully."}