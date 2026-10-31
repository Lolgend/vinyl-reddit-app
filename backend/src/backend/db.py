import os
from collections.abc import Generator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker


def get_database_url(url: str | None = None) -> str:
    """Retrieve and normalize database URL with psycopg dialect."""
    if not url:
        # Check current and parent directories for .env
        env_paths = [
            Path(".env"),
            Path(__file__).resolve().parent.parent.parent / ".env",
            Path(__file__).resolve().parent.parent.parent.parent.parent / "reddit-scrape" / ".env",
        ]
        for env_path in env_paths:
            if env_path.exists():
                load_dotenv(env_path)
                break

        url = os.environ.get("DATABASE_URL")

    if not url:
        raise ValueError("DATABASE_URL is not set in environment or .env")

    # Ensure SQLAlchemy psycopg dialect format: postgresql+psycopg://
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)

    return url


def get_readonly_engine(database_url: str | None = None, **kwargs) -> Engine:
    """Create a strictly read-only SQLAlchemy engine configured with psycopg."""
    url = get_database_url(database_url)

    execution_options = dict(kwargs.pop("execution_options", {}))
    execution_options["postgresql_readonly"] = True

    connect_args = dict(kwargs.pop("connect_args", {}))
    options_str = connect_args.get("options", "")
    readonly_option = "-c default_transaction_read_only=on"
    if readonly_option not in options_str:
        connect_args["options"] = f"{options_str} {readonly_option}".strip()

    return create_engine(
        url,
        execution_options=execution_options,
        connect_args=connect_args,
        **kwargs,
    )


_engine: Engine | None = None
_session_factory: sessionmaker | None = None


def get_engine() -> Engine:
    """Retrieve or create the global read-only engine."""
    global _engine
    if _engine is None:
        _engine = get_readonly_engine()
    return _engine


def get_readonly_session_factory(engine: Engine | None = None) -> sessionmaker:
    """Create a configured sessionmaker bound to engine."""
    if engine is None:
        engine = get_engine()
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a read-only database session."""
    global _session_factory
    if _session_factory is None:
        _session_factory = get_readonly_session_factory()
    session = _session_factory()
    try:
        yield session
    finally:
        session.close()


__all__ = [
    "get_database_url",
    "get_db",
    "get_engine",
    "get_readonly_engine",
    "get_readonly_session_factory",
]
