from datetime import datetime, timedelta, timezone

import pytest

from backend.services.hype import (
    calculate_hype_index,
    calculate_points,
    calculate_raw_hype,
    calculate_velocity,
    compute_submission_metrics,
    get_hype_tier,
    normalize_cohort_hype,
)


class TestPointsCalculation:
    def test_composite_engagement_points(self):
        # E = score + 2 * num_comments
        assert calculate_points(score=0, num_comments=0) == 0
        assert calculate_points(score=10, num_comments=0) == 10
        assert calculate_points(score=0, num_comments=5) == 10
        assert calculate_points(score=15, num_comments=7) == 29

    def test_negative_score_handling(self):
        # Score can theoretically be negative on Reddit
        assert calculate_points(score=-2, num_comments=3) == 4


class TestHypeVelocityAndAnchoring:
    def test_launch_velocity_for_single_snapshot_post_created_in_window(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        # Post created 2 hours ago inside 24H window
        post_created_utc = now - timedelta(hours=2)

        # Current points: score=20, num_comments=10 => E_curr = 40
        # Since created in window: E_base = 0, t_base = post_created_utc
        delta_e = 40 - 0
        velocity = calculate_velocity(
            delta_e=delta_e,
            t_base=post_created_utc,
            now=now,
        )
        # delta_t = 2.0 hours. velocity = round(40 / 2.0, 1) = 20.0
        assert velocity == 20.0

    def test_fifteen_minute_floor_for_brand_new_post(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        # Post created 5 minutes ago (0.0833 hours)
        post_created_utc = now - timedelta(minutes=5)

        # 10 points gained
        velocity = calculate_velocity(
            delta_e=10,
            t_base=post_created_utc,
            now=now,
        )
        # 15 min floor = 0.25h => round(10 / 0.25, 1) = 40.0
        assert velocity == 40.0

    def test_zero_delta_e_returns_zero_velocity(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        t_base = now - timedelta(hours=5)
        velocity = calculate_velocity(delta_e=0, t_base=t_base, now=now)
        assert velocity == 0.0


class TestRawHypeAndDecay:
    def test_raw_hype_decay_across_windows(self):
        # h_s = (v_s + delta_e / tau_W) * (0.5 + 0.5 * r_s) * 2^(-a_s / tau_W)
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        created_utc = now - timedelta(hours=12)  # age = 12h
        v_s = 20.0
        delta_e = 40
        upvote_ratio = 1.0

        # Window 24H: tau = 12.0h. Age = 12h => 1 half-life => 2^(-1) = 0.5
        # v_s + delta_e / 12.0 = 20.0 + 3.333333333 = 23.333333333
        # (0.5 + 0.5 * 1.0) = 1.0
        # h_s = 23.333333333 * 0.5 = 11.666666666...
        h_24h = calculate_raw_hype(
            velocity=v_s,
            delta_e=delta_e,
            created_utc=created_utc,
            upvote_ratio=upvote_ratio,
            window="24H",
            now=now,
        )
        assert pytest.approx(h_24h, rel=1e-3) == 11.6667

        # Window 7D: tau = 72.0h. Age = 12h => 2^(-12/72) = 2^(-1/6)
        # v_s + delta_e / 72.0 = 20.0 + 40/72 = 20.555555...
        # decay = 2**(-12/72) = 0.8908987
        h_7d = calculate_raw_hype(
            velocity=v_s,
            delta_e=delta_e,
            created_utc=created_utc,
            upvote_ratio=upvote_ratio,
            window="7D",
            now=now,
        )
        expected_7d = (20.0 + 40 / 72.0) * (2 ** (-12.0 / 72.0))
        assert pytest.approx(h_7d, rel=1e-3) == expected_7d

        # Window 1M: tau = 336.0h.
        expected_1m = (20.0 + 40 / 336.0) * (2 ** (-12.0 / 336.0))
        h_1m = calculate_raw_hype(
            velocity=v_s,
            delta_e=delta_e,
            created_utc=created_utc,
            upvote_ratio=upvote_ratio,
            window="1M",
            now=now,
        )
        assert pytest.approx(h_1m, rel=1e-3) == expected_1m

    def test_upvote_ratio_damping(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        created_utc = now
        # When upvote_ratio = 0.5: factor is 0.5 + 0.5 * 0.5 = 0.75
        h_half = calculate_raw_hype(
            velocity=10.0,
            delta_e=0,
            created_utc=created_utc,
            upvote_ratio=0.5,
            window="24H",
            now=now,
        )
        # When upvote_ratio = 1.0: factor is 1.0
        h_full = calculate_raw_hype(
            velocity=10.0,
            delta_e=0,
            created_utc=created_utc,
            upvote_ratio=1.0,
            window="24H",
            now=now,
        )
        assert pytest.approx(h_half / h_full, rel=1e-4) == 0.75


class TestCohortNormalizationAndFloor:
    def test_reference_floor_prevents_low_hype_cohort_from_maxing_to_100(self):
        # If max hype in cohort is 10.0 (< 25.0 reference floor):
        # scale = ln(1.0 + 25.0) = ln(26) ~= 3.2580965
        # entity hype = 10.0 => ln(11) ~= 2.397895
        # index = min(100, round(100 * 2.397895 / 3.2580965)) = round(73.598) = 74
        index = calculate_hype_index(
            raw_hype=10.0,
            cohort_max_raw_hype=10.0,
            reference_floor=25.0,
        )
        assert index == 74

    def test_cohort_max_above_floor_reaches_100(self):
        # When max hype is 100.0 (> 25.0)
        index = calculate_hype_index(
            raw_hype=100.0,
            cohort_max_raw_hype=100.0,
            reference_floor=25.0,
        )
        assert index == 100

    def test_zero_raw_hype_evaluates_to_zero(self):
        assert calculate_hype_index(0.0, cohort_max_raw_hype=50.0) == 0
        assert calculate_hype_index(0.0, cohort_max_raw_hype=0.0) == 0

    def test_cohort_normalization_helper(self):
        raw_list = [0.0, 10.0, 50.0, 100.0]
        indices = normalize_cohort_hype(raw_list, reference_floor=25.0)
        assert len(indices) == 4
        assert indices[0] == 0
        assert indices[3] == 100
        assert indices[1] < indices[2] < indices[3]


class TestHypeTiers:
    def test_tier_classification(self):
        assert get_hype_tier(100) == "high"
        assert get_hype_tier(75) == "high"
        assert get_hype_tier(74) == "moderate"
        assert get_hype_tier(40) == "moderate"
        assert get_hype_tier(39) == "low"
        assert get_hype_tier(0) == "low"


class TestComputeSubmissionMetrics:
    def test_submission_created_inside_window(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        # Created 2 hours ago inside 24H window
        created_utc = now - timedelta(hours=2)
        metrics = compute_submission_metrics(
            created_utc=created_utc,
            latest_score=20,
            latest_num_comments=10,
            latest_upvote_ratio=0.95,
            snapshots=[],
            window="24H",
            now=now,
        )
        assert metrics["velocity"] == 20.0
        assert metrics["delta_e"] == 40
        assert metrics["score"] == 20
        assert metrics["num_comments"] == 10
        assert metrics["created_utc"] == created_utc
        assert metrics["raw_hype"] > 0.0

    def test_submission_created_before_window_with_snapshots(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        t0 = now - timedelta(hours=24)
        created_utc = now - timedelta(hours=48)
        # Snapshots: one before t0 (score=10, c=2 => E=14), one inside window (score=30, c=5 => E=40)
        snapshots = [
            {"captured_at": t0 - timedelta(hours=2), "score": 10, "num_comments": 2},
            {"captured_at": now - timedelta(hours=1), "score": 30, "num_comments": 5},
        ]
        metrics = compute_submission_metrics(
            created_utc=created_utc,
            latest_score=30,
            latest_num_comments=5,
            latest_upvote_ratio=1.0,
            snapshots=snapshots,
            window="24H",
            now=now,
        )
        # delta_e = 40 - 14 = 26
        assert metrics["delta_e"] == 26
        # t_base is anchor snap before t0 (26h ago)
        # elapsed = 26h => velocity = round(26 / 26.0, 1) = 1.0
        assert metrics["velocity"] == 1.0

    def test_submission_fifteen_minute_floor(self):
        now = datetime(2026, 10, 31, 12, 0, 0, tzinfo=timezone.utc)
        created_utc = now - timedelta(minutes=5)
        metrics = compute_submission_metrics(
            created_utc=created_utc,
            latest_score=10,
            latest_num_comments=0,
            latest_upvote_ratio=1.0,
            snapshots=[],
            window="24H",
            now=now,
        )
        # 10 points / 0.25 hours = 40.0 pts/hr
        assert metrics["velocity"] == 40.0

