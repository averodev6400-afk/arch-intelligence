import json
import math
from typing import Optional

from fastapi import HTTPException

from src.archs.repositories import archs_repository


class ArchService:

    async def create_arch(self, data):
        result = await archs_repository.create_arch(data)
        return json.loads(result.model_dump_json())

    async def list_archs(self, page: int, limit: int, search: Optional[str] = None):
        archs, total = await archs_repository.list_archs(page, limit, search)
        items = [json.loads(a.model_dump_json()) for a in archs]
        pages = math.ceil(total / limit) if total > 0 else 0
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}

    async def get_arch(self, arch_id: str):
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Arch not found.")
        return json.loads(arch.model_dump_json())

    async def update_arch(self, arch_id: str, update_data):
        arch = await archs_repository.update_arch(arch_id, update_data)
        if not arch:
            raise HTTPException(status_code=404, detail="Arch not found.")
        return json.loads(arch.model_dump_json())

    async def delete_arch(self, arch_id: str) -> None:
        deleted = await archs_repository.delete_arch(arch_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Arch not found.")


archs_service = ArchService()
