import json
import math
import yaml

from fastapi import HTTPException

from src.archs.repositories.arch_chats_repository import arch_chats_repository
from src.archs.repositories import archs_repository
from src.usage.repositories.usage_repository import usage_repository

from configs.llm_integration import llm_integration
from src.constants.prompts import ARCHITECTURE_ADVISOR

class ArchChatsService:

    async def create_chat(self, arch_id: str, question: str):
        # Verify the arch exists
        arch = await archs_repository.get_arch(arch_id)
        if not arch:
            raise HTTPException(status_code=404, detail="Architecture not found.")

        # Fetch recent conversation history for context (last 10 exchanges)
        history = await arch_chats_repository.get_context_chats(arch_id, limit=10)

        # System prompt includes the architecture so it persists across all turns
        # Strip UI-only fields (color_theme, font_size) — irrelevant to reasoning
        _UI_FIELDS = {'color_theme', 'font_size'}
        arch_dict = arch.model_dump()
        for node in arch_dict.get('nodes', []):
            for field in _UI_FIELDS:
                node.pop(field, None)
        arch_yaml = yaml.dump(arch_dict, allow_unicode=True, sort_keys=False)
        messages = [
            {
                "role": "system",
                "content": f"{ARCHITECTURE_ADVISOR}\n\n**Current Architecture (YAML):**\n{arch_yaml}"
            }
        ]

        # Replay previous turns so the LLM has full conversation context
        for chat in history:
            messages.append({"role": "user", "content": chat.question})
            messages.append({"role": "assistant", "content": chat.answer})

        # Append the new question
        messages.append({"role": "user", "content": question})

        llm_response = llm_integration.query_llm(messages)

        answer = llm_response.choices[0].message.content if llm_response and llm_response.choices else "Sorry, I couldn't generate a response."

        if llm_response and llm_response.usage:
            u = llm_response.usage
            await usage_repository.create(
                arch_id=arch_id,
                model=llm_response.model,
                prompt_tokens=u.prompt_tokens,
                completion_tokens=u.completion_tokens,
                total_tokens=u.total_tokens,
            )

        chat = await arch_chats_repository.create_chat(arch_id, question, answer)
        return json.loads(chat.model_dump_json())

    async def list_chats(self, arch_id: str, page: int, limit: int):
        chats, total = await arch_chats_repository.list_chats(arch_id, page, limit)
        items = [json.loads(c.model_dump_json()) for c in chats]
        pages = math.ceil(total / limit) if total > 0 else 0
        return {"items": items, "total": total, "page": page, "limit": limit, "pages": pages}


arch_chats_service = ArchChatsService()
