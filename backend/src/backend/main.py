import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import api_router

app = FastAPI(
    title="Vinyl Demand Intelligence API",
    description="Read-only demand intelligence API for r/vinylreleases data",
    version="0.1.0",
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


def main() -> None:
    """Entry point for running the API server."""
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)


if __name__ == "__main__":
    main()
