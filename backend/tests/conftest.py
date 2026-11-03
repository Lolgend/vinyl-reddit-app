import pytest

from backend.db import get_readonly_engine, get_readonly_session_factory


@pytest.fixture(scope="module")
def readonly_engine():
    return get_readonly_engine()


@pytest.fixture
def readonly_session(readonly_engine):
    session_factory = get_readonly_session_factory(readonly_engine)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()
