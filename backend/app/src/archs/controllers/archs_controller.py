from typing import Optional

from fastapi import APIRouter, Query

from src.archs.schemas import CreateArch, UpdateArch, Arch, ArchListResponse, CreateArchChat, ArchChatResponse, ArchChatListResponse
from src.archs.services import archs_service
from src.archs.services.arch_chats_service import arch_chats_service
from configs.response import SuccessResponse, ErrorResponse

router = APIRouter(
    prefix="/archs",
    tags=["Archs"],
)

@router.get(
    path="/",
    summary="List architectures",
    description="Retrieve a paginated list of architectures in descending order. Supports searching by name and description.",
    responses={
        200: {"description": "Architectures retrieved successfully.", "model": SuccessResponse[ArchListResponse]},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def list_archs(
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=10, ge=1, le=100, description="Records per page (max 100)"),
    search: Optional[str] = Query(default=None, description="Search term for name or description"),
):
    result = await archs_service.list_archs(page, limit, search)
    return {"success": True, "data": result, "message": "Architectures retrieved successfully."}

@router.post(
    path="/",
    summary="Create a new architecture",
    description="Create a new architecture with nodes and edges.",
    responses={
        200: {"description": "Architecture created successfully.", "model": SuccessResponse[Arch]},
        400: {"description": "Invalid input data.", "model": ErrorResponse},
        422: {"description": "Validation error.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def create_arch(payload: CreateArch):
    result = await archs_service.create_arch(payload)
    return {"success": True, "data": result, "message": "Architecture created successfully."}

@router.get(
    path="/{arch_id}",
    summary="Get an architecture",
    description="Retrieve a single architecture by its ID.",
    responses={
        200: {"description": "Architecture retrieved successfully.", "model": SuccessResponse[Arch]},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def get_arch(arch_id: str):
    result = await archs_service.get_arch(arch_id)
    return {"success": True, "data": result, "message": "Architecture retrieved successfully."}

@router.patch(
    path="/{arch_id}",
    summary="Update an architecture",
    description="Update an existing architecture's name or description.",
    responses={
        200: {"description": "Architecture updated successfully.", "model": SuccessResponse[Arch]},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
        422: {"description": "Validation error.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def update_arch(arch_id: str, payload: UpdateArch):
    result = await archs_service.update_arch(arch_id, payload)
    return {"success": True, "data": result, "message": "Architecture updated successfully."}

@router.delete(
    path="/{arch_id}",
    summary="Delete an architecture",
    description="Delete an architecture by its ID.",
    responses={
        200: {"description": "Architecture deleted successfully.", "model": SuccessResponse},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def delete_arch(arch_id: str):
    await archs_service.delete_arch(arch_id)
    return {"success": True, "data": None, "message": "Architecture deleted successfully."}


# ─── Chat Endpoints ───────────────────────────────────────────────────────────

@router.post(
    path="/{arch_id}/chats",
    summary="Send a chat message",
    description="Ask a question about the architecture and get an answer.",
    responses={
        200: {"description": "Chat response generated.", "model": SuccessResponse[ArchChatResponse]},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def create_chat(arch_id: str, payload: CreateArchChat):
    result = await arch_chats_service.create_chat(arch_id, payload.question)
    return {"success": True, "data": result, "message": "Chat response generated."}


@router.get(
    path="/{arch_id}/chats",
    summary="List chat messages",
    description="Retrieve paginated chat history for an architecture.",
    responses={
        200: {"description": "Chats retrieved successfully.", "model": SuccessResponse[ArchChatListResponse]},
        500: {"description": "Internal server error.", "model": ErrorResponse},
    },
)
async def list_chats(
    arch_id: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    limit: int = Query(default=50, ge=1, le=100, description="Records per page"),
):
    result = await arch_chats_service.list_chats(arch_id, page, limit)
    return {"success": True, "data": result, "message": "Chats retrieved successfully."}
