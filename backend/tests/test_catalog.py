import hashlib
import uuid

import pytest
from sqlalchemy import text

from backend.db import get_readonly_engine, get_readonly_session_factory
from backend.services.catalog import (
    CatalogAlbum,
    DerivedAlbum,
    classify_artist_attribution,
    derive_album_id,
    get_all_derived_albums,
    get_artist_catalog_counts,
    get_artists_catalog_counts,
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


class TestAlbumIdDerivation:
    def test_album_id_is_16_char_lowercase_hex(self):
        album_id = derive_album_id("the smashing pumpkins", "lull")
        assert len(album_id) == 16
        assert album_id == album_id.lower()
        # Verify deterministic match with manual sha256
        expected = hashlib.sha256(b"the smashing pumpkins|lull").hexdigest()[:16]
        assert album_id == expected

    def test_album_id_stability_across_runs(self):
        id1 = derive_album_id("radiohead", "in rainbows")
        id2 = derive_album_id("radiohead", "in rainbows")
        assert id1 == id2
        assert len(id1) == 16


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

    def test_deprecated_derived_albums_shim(self, readonly_session):
        derived = get_all_derived_albums(readonly_session)
        assert len(derived) == 39
        item = derived[0]
        assert isinstance(item, (CatalogAlbum, DerivedAlbum))
        assert item.album_id is not None
        assert item.earliest_created_at is not None

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

    def test_batch_artist_catalog_counts(self, readonly_session):
        carly_id = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = 'Carly Rae Jepsen'")
        ).scalar()
        chainz_id = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = '2 Chainz'")
        ).scalar()
        assert carly_id is not None
        assert chainz_id is not None

        counts = get_artists_catalog_counts(readonly_session, [carly_id, chainz_id, "invalid-uuid"])
        assert counts[str(carly_id)] == (2, 0)
        assert counts[str(chainz_id)] == (0, 1)
