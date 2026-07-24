import beanie
import motor.motor_asyncio

from configs.logger import logger
from configs.settings import settings

from src.nodes.models.node_model import Node
from src.archs.models.arch_model import Arch
from src.archs.models.arch_chat_model import ArchChat
from src.usage.models.usage_model import LLMUsage
from src.scenarios.models.scenario_model import Scenario

async def connect_db():
    """
    Connect to MongoDB using Motor and initialize Beanie ODM.
    """
    try:
        logger.info("Connecting to MongoDB...")
        client = motor.motor_asyncio.AsyncIOMotorClient(
            settings.MONGO_URI, serverSelectionTimeoutMS=5000
        )
        db = client[settings.MONGO_DB_NAME]

        await client.admin.command("ping")
        await beanie.init_beanie(database=db, document_models=[
            Node,
            Arch,
            ArchChat,
            LLMUsage,
            Scenario,
        ])
        
        logger.info("Connected to MongoDB successfully.")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise e
