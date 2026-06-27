import json
import math

from fastapi import HTTPException

from src.archs.repositories.arch_chats_repository import arch_chats_repository
from src.archs.repositories import archs_repository

from configs.llm_integration import llm_integration
from src.constants.prompts import ARCHITECTURE_ADVISOR

class ArchChatsService:

    async def create_chat(self, arch_id: str, question: str):
        # Verify the arch exists
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Architecture not found.")

        llm_response = llm_integration.query_llm([
            {
                "role": "system",
                "content": ARCHITECTURE_ADVISOR
            },
            {
                "role": "user",
                "content": f"Input Architecture JSON\n{arch.model_dump_json()}\n\nQuestion: {question}"
            }
        ])

        # For now, return a placeholder response
        answer = llm_response.choices[0].message.content if llm_response and llm_response.choices else "Sorry, I couldn't generate a response."

        chat = await arch_chats_repository.create_chat(arch_id, question, answer)
        return json.loads(chat.model_dump_json())

    async def list_chats(self, arch_id: str, page: int, limit: int):
        chats, total = await arch_chats_repository.list_chats(arch_id, page, limit)
        items = [json.loads(c.model_dump_json()) for c in chats]
        pages = math.ceil(total / limit) if total > 0 else 0
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


arch_chats_service = ArchChatsService()
