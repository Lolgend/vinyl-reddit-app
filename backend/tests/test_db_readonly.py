import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

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


def test_readonly_select_succeeds(readonly_session):
    result = readonly_session.execute(text("SELECT 1 AS num")).scalar()
    assert result == 1


def test_readonly_select_submissions_table(readonly_session):
    result = readonly_session.execute(text("SELECT count(*) FROM submissions")).scalar()
    assert isinstance(result, int)
    assert result >= 0


def test_readonly_insert_fails(readonly_session):
    with pytest.raises(DBAPIError) as exc_info:
        readonly_session.execute(
            text(
                "INSERT INTO submissions (id, reddit_id, title, url, latest_score, latest_upvote_ratio, "
                "latest_num_comments, created_utc, is_extracted, is_release) "
                "VALUES ('test_ro_id', 'test_ro', 'test title', 'https://reddit.com', 0, 1.0, 0, NOW(), false, true)"
            )
        )
    assert "read-only transaction" in str(exc_info.value).lower()


def test_readonly_update_fails(readonly_session):
    with pytest.raises(DBAPIError) as exc_info:
        readonly_session.execute(
            text("UPDATE submissions SET title = 'updated' WHERE id = 'nonexistent'")
        )
    assert "read-only transaction" in str(exc_info.value).lower()


def test_readonly_delete_fails(readonly_session):
    with pytest.raises(DBAPIError) as exc_info:
        readonly_session.execute(
            text("DELETE FROM submissions WHERE id = 'nonexistent'")
        )
    assert "read-only transaction" in str(exc_info.value).lower()
