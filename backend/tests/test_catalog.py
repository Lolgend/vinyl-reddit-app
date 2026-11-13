import uuid

import pytest
from sqlalchemy import text

from backend.db import get_readonly_engine, get_readonly_session_factory
from backend.services.catalog import (
    classify_artist_attribution,
    get_artist_catalog_counts,
    get_catalog_album,
    get_catalog_albums,
    normalize_attribute,
)


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


class TestAttributeNormalization:
    def test_unicode_dashes_normalized_to_hyphen(self):
        # Unicode dashes \u2010 to \u2015 and \u2212
        raw = "Blink\u2010182 \u2013 Greatest\u2014Hits \u2212 Deluxe"
        assert normalize_attribute(raw) == "blink-182 - greatest-hits - deluxe"

    def test_whitespace_collapsed_and_lowercased(self):
        raw = "   The   Smashing    Pumpkins \t\n  "
        assert normalize_attribute(raw) == "the smashing pumpkins"

    def test_none_and_empty_handling(self):
        assert normalize_attribute(None) == ""
        assert normalize_attribute("") == ""
        assert normalize_attribute("   ") == ""


class TestArtistAttribution:
    def test_solo_classification(self):
        # Exactly 1 artist and name matches combined_artist
        assert classify_artist_attribution("Radiohead", "Radiohead", 1) == "solo"
        assert classify_artist_attribution("radiohead", "RADIOHEAD", 1) == "solo"

    def test_combined_when_multiple_linked_artists(self):
        # Name matches combined_artist but multiple artists linked
        assert classify_artist_attribution("Converge", "Converge", 2) == "combined"

    def test_combined_when_name_differs(self):
        # Single linked artist, but combined_artist string has collaborative text
        assert (
            classify_artist_attribution(
                "Popular Music", "Popular Music (ft. Zac Pennington of Parenthetical Girls)", 1
            )
            == "combined"
        )

    def test_split_release_collaboration(self):
        # Split release billing "Converge / Dropdead"
        assert classify_artist_attribution("Converge", "Converge / Dropdead", 2) == "combined"
        assert classify_artist_attribution("Dropdead", "Converge / Dropdead", 2) == "combined"

    def test_unlinked_single_billed_is_solo(self):
        # When 0 linked artists in album_artists, single-billed artists are classified as 'solo'
        assert classify_artist_attribution(None, "Radiohead", 0) == "solo"
        assert classify_artist_attribution("Radiohead", "Radiohead", 0) == "solo"
        assert classify_artist_attribution(None, "The Smashing Pumpkins", 0) == "solo"
        assert classify_artist_attribution(None, "Blink-182", 0) == "solo"

    def test_unlinked_collaborative_is_combined(self):
        # When 0 linked artists, collaborative/split billings are classified as 'combined'
        assert classify_artist_attribution(None, "Converge / Dropdead", 0) == "combined"
        assert classify_artist_attribution(None, "Kanye West & Ty Dolla $ign", 0) == "combined"
        assert (
            classify_artist_attribution(
                None, "Popular Music (ft. Zac Pennington of Parenthetical Girls)", 0
            )
            == "combined"
        )
        assert classify_artist_attribution(None, "2 Chainz & Statik Selektah", 0) == "combined"


class TestDatabaseCatalogDerivations:
    def test_persisted_album_catalog_retrieval(self, readonly_session):
        albums = get_catalog_albums(readonly_session)
        assert len(albums) == 39

        for alb in albums:
            # Validate UUID string format
            parsed_uuid = uuid.UUID(alb.album_id)
            assert str(parsed_uuid) == alb.album_id
            assert alb.combined_artist
            assert alb.album_title
            assert alb.release_count >= 0
            assert alb.created_at is not None
            assert alb.norm_artist == normalize_attribute(alb.combined_artist)
            assert alb.norm_album == normalize_attribute(alb.album_title)

        # Check known multi-pressing album
        muse_album = next((a for a in albums if a.album_title == "Muse"), None)
        assert muse_album is not None
        assert muse_album.combined_artist == "John Legend"
        assert muse_album.release_count == 3

    def test_get_catalog_album_by_id(self, readonly_session):
        albums = get_catalog_albums(readonly_session)
        target = albums[0]

        fetched = get_catalog_album(readonly_session, target.album_id)
        assert fetched is not None
        assert fetched.album_id == target.album_id
        assert fetched.combined_artist == target.combined_artist
        assert fetched.album_title == target.album_title
        assert fetched.release_count == target.release_count

        # Test non-existent valid UUID
        random_uuid = str(uuid.uuid4())
        assert get_catalog_album(readonly_session, random_uuid) is None

        # Test invalid UUID syntax does not raise DataError
        assert get_catalog_album(readonly_session, "invalid-uuid-string") is None

    def test_artist_catalog_counts(self, readonly_session):
        # Carly Rae Jepsen has 2 solo albums
        carly_id = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = 'Carly Rae Jepsen'")
        ).scalar()
        assert carly_id is not None
        solo_cnt, comb_cnt = get_artist_catalog_counts(readonly_session, carly_id)
        assert solo_cnt == 2
        assert comb_cnt == 0

        # 2 Chainz has 1 collaborative/combined album (2 Chainz & Statik Selektah)
        chainz_id = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = '2 Chainz'")
        ).scalar()
        assert chainz_id is not None
        solo_cnt, comb_cnt = get_artist_catalog_counts(readonly_session, chainz_id)
        assert solo_cnt == 0
        assert comb_cnt == 1

        # Non-existent UUID
        assert get_artist_catalog_counts(readonly_session, uuid.uuid4()) == (0, 0)

        # Malformed UUID string
        assert get_artist_catalog_counts(readonly_session, "malformed-uuid") == (0, 0)
