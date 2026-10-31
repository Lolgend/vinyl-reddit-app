from fastapi import APIRouter

from backend.api.albums import router as albums_router
from backend.api.dashboard import router as dashboard_router
from backend.api.directory import router as directory_router
from backend.api.health import router as health_router
from backend.api.search import router as search_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health_router)
api_router.include_router(albums_router, prefix="/albums", tags=["albums"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(directory_router, prefix="/directory", tags=["directory"])
api_router.include_router(search_router, prefix="/search", tags=["search"])

__all__ = ["api_router"]
