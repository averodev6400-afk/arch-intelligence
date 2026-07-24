from src.usage.models.usage_model import LLMUsage


class UsageRepository:

    async def create(self, arch_id: str, model: str, prompt_tokens: int, completion_tokens: int, total_tokens: int) -> LLMUsage:
        record = LLMUsage(
            arch_id=arch_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
        )
        return await record.insert()


usage_repository = UsageRepository()
