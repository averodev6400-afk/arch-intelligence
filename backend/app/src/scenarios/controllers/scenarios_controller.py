from fastapi import APIRouter, Query

from configs.response import ErrorResponse, SuccessResponse
from src.scenarios.schemas.scenarios_schema import (
    CreateScenario,
    ScenarioListResponse,
    ScenarioResponse,
    UpdateScenario,
)
from src.scenarios.services.scenarios_service import scenarios_service

router = APIRouter(
    prefix="/archs/{arch_id}/scenarios",
    tags=["Scenarios"],
)


@router.get(
    path="",
    summary="List scenarios for an architecture",
    responses={
        200: {"description": "Scenarios retrieved successfully.", "model": SuccessResponse[ScenarioListResponse]},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
    },
)
async def list_scenarios(
    arch_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=100),
):
    result = await scenarios_service.list_by_arch(arch_id, page, limit)
    return {"success": True, "data": result, "message": "Scenarios retrieved successfully."}


@router.post(
    path="",
    summary="Create a scenario",
    responses={
        200: {"description": "Scenario created successfully.", "model": SuccessResponse[ScenarioResponse]},
        404: {"description": "Architecture not found.", "model": ErrorResponse},
    },
)
async def create_scenario(arch_id: str, payload: CreateScenario):
    result = await scenarios_service.create(arch_id, payload)
    return {"success": True, "data": result, "message": "Scenario created successfully."}


@router.get(
    path="/{scenario_id}",
    summary="Get a scenario",
    responses={
        200: {"description": "Scenario retrieved successfully.", "model": SuccessResponse[ScenarioResponse]},
        404: {"description": "Scenario not found.", "model": ErrorResponse},
    },
)
async def get_scenario(arch_id: str, scenario_id: str):
    result = await scenarios_service.get(arch_id, scenario_id)
    return {"success": True, "data": result, "message": "Scenario retrieved successfully."}


@router.patch(
    path="/{scenario_id}",
    summary="Update a scenario's metadata or overrides",
    responses={
        200: {"description": "Scenario updated successfully.", "model": SuccessResponse[ScenarioResponse]},
        404: {"description": "Scenario not found.", "model": ErrorResponse},
    },
)
async def update_scenario(arch_id: str, scenario_id: str, payload: UpdateScenario):
    result = await scenarios_service.update(arch_id, scenario_id, payload)
    return {"success": True, "data": result, "message": "Scenario updated successfully."}


@router.post(
    path="/{scenario_id}/generate",
    summary="Generate Best/Mid/Worst simulation for a scenario",
    description="Reads the current architecture nodes and produces load matrices for each component.",
    responses={
        200: {"description": "Simulation generated successfully.", "model": SuccessResponse[ScenarioResponse]},
        404: {"description": "Scenario or architecture not found.", "model": ErrorResponse},
    },
)
async def generate_scenario(arch_id: str, scenario_id: str):
    result = await scenarios_service.generate(arch_id, scenario_id)
    return {"success": True, "data": result, "message": "Simulation generated successfully."}


@router.delete(
    path="/{scenario_id}",
    summary="Delete a scenario",
    responses={
        200: {"description": "Scenario deleted successfully.", "model": SuccessResponse},
        404: {"description": "Scenario not found.", "model": ErrorResponse},
    },
)
async def delete_scenario(arch_id: str, scenario_id: str):
    await scenarios_service.delete(arch_id, scenario_id)
    return {"success": True, "data": None, "message": "Scenario deleted successfully."}
