from datetime import datetime, timedelta, timezone

from backend.services.timeseries import (
    calculate_share_of_demand,
    compute_locf_time_series,
    generate_window_boundaries,
    get_submission_markers,
)


class TestWindowBoundaries:
    def test_24h_window_boundaries(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        boundaries = generate_window_boundaries("24H", now)

        # 24 intervals * 1 hour => 25 boundary timestamps
        assert len(boundaries) == 25
        assert boundaries[0] == now - timedelta(hours=24)
        assert boundaries[-1] == now
        for i in range(1, len(boundaries)):
            diff = (boundaries[i] - boundaries[i - 1]).total_seconds()
            assert diff == 3600.0  # exactly 1 hour

    def test_7d_window_boundaries(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        boundaries = generate_window_boundaries("7D", now)

        # 28 intervals * 6 hours => 29 boundary timestamps (168 hours total)
        assert len(boundaries) == 29
        assert boundaries[0] == now - timedelta(hours=168)
        assert boundaries[-1] == now
        for i in range(1, len(boundaries)):
            diff = (boundaries[i] - boundaries[i - 1]).total_seconds()
            assert diff == 6 * 3600.0  # exactly 6 hours

    def test_1m_window_boundaries(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        boundaries = generate_window_boundaries("1M", now)

        # 30 intervals * 24 hours => 31 boundary timestamps (720 hours total)
        assert len(boundaries) == 31
        assert boundaries[0] == now - timedelta(hours=720)
        assert boundaries[-1] == now
        for i in range(1, len(boundaries)):
            diff = (boundaries[i] - boundaries[i - 1]).total_seconds()
            assert diff == 24 * 3600.0  # exactly 24 hours


class TestLOCFPointSampling:
    def test_locf_sampling_stepped_cumulative_points_and_velocity(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        # Submissions created 4 hours ago and 2 hours ago
        sub1_id = "sub1"
        sub1_created = now - timedelta(hours=4)
        sub2_id = "sub2"
        sub2_created = now - timedelta(hours=2)

        submissions = [
            {
                "id": sub1_id,
                "title": "Sub 1",
                "created_utc": sub1_created,
                "latest_score": 30,
                "latest_num_comments": 10,
            },
            {
                "id": sub2_id,
                "title": "Sub 2",
                "created_utc": sub2_created,
                "latest_score": 15,
                "latest_num_comments": 5,
            },
        ]

        # Snapshots for sub1:
        # at created + 1h (now - 3h): score 10, comments 2 => points = 10 + 4 = 14
        # at created + 2h (now - 2h): score 20, comments 5 => points = 20 + 10 = 30
        # at created + 3h (now - 1h): score 30, comments 10 => points = 30 + 20 = 50
        snapshots_by_sub = {
            sub1_id: [
                {
                    "captured_at": now - timedelta(hours=3),
                    "score": 10,
                    "num_comments": 2,
                },
                {
                    "captured_at": now - timedelta(hours=2),
                    "score": 20,
                    "num_comments": 5,
                },
                {
                    "captured_at": now - timedelta(hours=1),
                    "score": 30,
                    "num_comments": 10,
                },
            ],
            # Snapshots for sub2:
            # at created + 1h (now - 1h): score 15, comments 5 => points = 15 + 10 = 25
            sub2_id: [
                {
                    "captured_at": now - timedelta(hours=1),
                    "score": 15,
                    "num_comments": 5,
                },
            ],
        }

        buckets = compute_locf_time_series(
            submissions=submissions,
            snapshots_by_sub=snapshots_by_sub,
            window="24H",
            now=now,
        )

        assert len(buckets) == 24
        # At now - 5h (bucket ending at now - 5h): before sub1 & sub2 creation => cumulative points = 0
        assert buckets[-6]["cumulative_points"] == 0

        # At now (last bucket ending at now):
        # sub1 carried forward from now - 1h: 50 points
        # sub2 carried forward from now - 1h: 25 points
        # Total cumulative points = 75
        assert buckets[-1]["cumulative_points"] == 75
        # Verify velocity is non-negative and properly computed per hour
        for b in buckets:
            assert b["velocity_pts_per_hr"] >= 0.0
            assert "timestamp" in b
            assert "points" in b
            assert "velocity" in b


class TestShareOfDemandCalculator:
    def test_share_of_demand_percentages_sum_to_100(self):
        releases = [
            {"release_id": "rel-1", "variant": "Red", "retailer_name": "Rough Trade"},
            {"release_id": "rel-2", "variant": "Blue", "retailer_name": "Bandcamp"},
            {"release_id": "rel-3", "variant": "Clear", "retailer_name": "Target"},
        ]

        # Engagement points:
        # rel-1: score 60, comments 20 => 60 + 40 = 100 pts
        # rel-2: score 30, comments 10 => 30 + 20 = 50 pts
        # rel-3: score 30, comments 10 => 30 + 20 = 50 pts
        # Total = 200 pts.
        # rel-1 share = 50.0%, rel-2 share = 25.0%, rel-3 share = 25.0%
        submissions_by_release = {
            "rel-1": [{"id": "s1", "latest_score": 60, "latest_num_comments": 20}],
            "rel-2": [{"id": "s2", "latest_score": 30, "latest_num_comments": 10}],
            "rel-3": [{"id": "s3", "latest_score": 30, "latest_num_comments": 10}],
        }

        shares = calculate_share_of_demand(releases, submissions_by_release)

        assert len(shares) == 3
        rel1 = next(s for s in shares if s["release_id"] == "rel-1")
        rel2 = next(s for s in shares if s["release_id"] == "rel-2")
        rel3 = next(s for s in shares if s["release_id"] == "rel-3")

        assert rel1["share_percentage"] == 50.0
        assert rel2["share_percentage"] == 25.0
        assert rel3["share_percentage"] == 25.0
        assert sum(s["share_percentage"] for s in shares) == 100.0

    def test_share_of_demand_zero_engagement_fallback(self):
        # 3 releases, 0 total engagement points => uniform fallback 100.0 / 3 = 33.3%
        # sum must be exactly 100.0%
        releases = [
            {"release_id": "rel-1", "variant": "Red", "retailer_name": "Rough Trade"},
            {"release_id": "rel-2", "variant": "Blue", "retailer_name": "Bandcamp"},
            {"release_id": "rel-3", "variant": "Clear", "retailer_name": "Target"},
        ]
        submissions_by_release = {
            "rel-1": [],
            "rel-2": [],
            "rel-3": [],
        }

        shares = calculate_share_of_demand(releases, submissions_by_release)

        assert len(shares) == 3
        total_share = sum(s["share_percentage"] for s in shares)
        assert round(total_share, 1) == 100.0
        for s in shares:
            assert 33.3 <= s["share_percentage"] <= 33.4
            assert s["points"] == 0


class TestEventMarkers:
    def test_event_markers_within_window(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        t0 = now - timedelta(hours=24)

        submissions = [
            {
                "id": "sub-old",
                "title": "Old Post",
                "created_utc": now - timedelta(hours=48),
            },
            {
                "id": "sub-inside-1",
                "title": "Inside Post 1",
                "created_utc": now - timedelta(hours=10),
            },
            {
                "id": "sub-inside-2",
                "title": "Inside Post 2",
                "created_utc": now - timedelta(hours=2),
            },
        ]

        markers = get_submission_markers(submissions, t0, now)
        assert len(markers) == 2
        assert markers[0]["submission_id"] == "sub-inside-1"
        assert markers[1]["submission_id"] == "sub-inside-2"
        assert markers[0]["title"] == "Inside Post 1"
