from typing import Optional

from beanie import PydanticObjectId

from src.archs.models.arch_chat_model import ArchChat


class ArchChatsRepository:

    async def create_chat(self, arch_id: str, question: str, answer: str) -> ArchChat:
        chat = ArchChat(arch_id=arch_id, question=question, answer=answer)
        return await chat.insert()

    async def list_chats(self, arch_id: str, page: int, limit: int) -> tuple[list[ArchChat], int]:
        skip = (page - 1) * limit
        filter_query = ArchChat.arch_id == arch_id
        total = await ArchChat.find(filter_query).count()
        chats = (
            await ArchChat.find(filter_query)
            .sort(-ArchChat.created_at)
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return chats, total

    async def get_context_chats(self, arch_id: str, limit: int = 10) -> list[ArchChat]:
        """Fetch the most recent `limit` chats in chronological order for LLM context."""
        chats = (
            await ArchChat.find(ArchChat.arch_id == arch_id)
            .sort(-ArchChat.created_at)
            .limit(limit)
            .to_list()
        )
        return list(reversed(chats))


arch_chats_repository = ArchChatsRepository()
