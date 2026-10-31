import hashlib

import pytest
from sqlalchemy import text

from backend.db import get_readonly_engine, get_readonly_session_factory
from backend.services.catalog import (
    classify_artist_attribution,
    derive_album_id,
    get_all_derived_albums,
    get_artist_catalog_counts,
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
    def test_earliest_casing_selection(self, readonly_session):
        derived_albums = get_all_derived_albums(readonly_session)
        assert len(derived_albums) > 0

        # Find "the smashing pumpkins" / "lull"
        lull_album = next(
            (
                a
                for a in derived_albums
                if a.norm_artist == "the smashing pumpkins" and a.norm_album == "lull"
            ),
            None,
        )
        assert lull_album is not None
        assert lull_album.combined_artist == "The Smashing Pumpkins"
        assert lull_album.album_title == "Lull"
        assert lull_album.release_count >= 2

    def test_artist_catalog_counts(self, readonly_session):
        # Query known artists from database
        popular_music = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = 'Popular Music'")
        ).scalar()
        if popular_music:
            solo_cnt, comb_cnt = get_artist_catalog_counts(readonly_session, popular_music)
            assert solo_cnt == 0
            assert comb_cnt >= 1

        smashing_pumpkins = readonly_session.execute(
            text("SELECT id FROM artists WHERE name = 'The Smashing Pumpkins'")
        ).scalar()
        if smashing_pumpkins:
            solo_cnt, comb_cnt = get_artist_catalog_counts(readonly_session, smashing_pumpkins)
            assert solo_cnt >= 1
            assert comb_cnt == 0
