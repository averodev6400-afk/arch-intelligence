import re
from datetime import datetime, timezone
from typing import Optional

from beanie import PydanticObjectId
from beanie.operators import Or, RegEx

from src.archs.models.arch_model import Arch as ArchDocument
from src.archs.schemas import CreateArch, UpdateArch


class ArchsRepository:

    async def create_arch(self, data: CreateArch) -> ArchDocument:
        return await ArchDocument(**data.model_dump()).insert()

    async def list_archs(self, page: int, limit: int, search: Optional[str] = None) -> tuple[list, int]:
        skip = (page - 1) * limit
        if search:
            pattern = re.compile(re.escape(search), re.IGNORECASE)
            filter_query = Or(
                RegEx(ArchDocument.name, pattern),
                RegEx(ArchDocument.description, pattern),
            )
            total = await ArchDocument.find(filter_query).count()
            archs = (
                await ArchDocument.find(filter_query)
                .sort(-ArchDocument.created_at)
                .skip(skip)
                .limit(limit)
                .to_list()
            )
        else:
            total = await ArchDocument.count()
            archs = (
                await ArchDocument.find()
                .sort(-ArchDocument.created_at)
                .skip(skip)
                .limit(limit)
                .to_list()
            )
        return archs, total

    async def get_arch(self, arch_id: str) -> Optional[ArchDocument]:
        return await ArchDocument.get(PydanticObjectId(arch_id))

    async def update_arch(self, arch_id: str, update_data: UpdateArch) -> Optional[ArchDocument]:
        arch = await ArchDocument.get(PydanticObjectId(arch_id))
        if not arch:
            return None
        update_dict = update_data.model_dump(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc)
        await arch.set(update_dict)
        return arch

    async def delete_arch(self, arch_id: str) -> bool:
        arch = await ArchDocument.get(PydanticObjectId(arch_id))
        if not arch:
            return False
        await arch.delete()
        return True


archs_repository = ArchsRepository()
