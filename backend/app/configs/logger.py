import logging

logging.getLogger("uvicorn").propagate = False
logging.getLogger("uvicorn.error").propagate = False
logging.getLogger("uvicorn.access").propagate = False

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(name)s %(asctime)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

logger = logging.getLogger("app_service")
