"""Tests for app/utils/data_sampling.py"""

import pytest
import pandas as pd
import numpy as np

from app.utils.data_sampling import DataSampler, calculate_significance_threshold


@pytest.fixture
def sampler():
    return DataSampler(max_sample_size=100, random_seed=42)


@pytest.fixture
def small_data():
    return [{"value": i, "category": "A" if i % 2 == 0 else "B"} for i in range(10)]


@pytest.fixture
def large_data():
    return [{"value": i, "category": chr(65 + (i % 5))} for i in range(500)]


# ── DataSampler.__init__ ──────────────────────────────────────────────────────


def test_init_defaults():
    s = DataSampler()
    assert s.max_sample_size == 5000
    assert s.random_seed == 42


def test_init_custom():
    s = DataSampler(max_sample_size=200, random_seed=7)
    assert s.max_sample_size == 200
    assert s.random_seed == 7


# ── reservoir_sample ─────────────────────────────────────────────────────────


def test_reservoir_sample_small_returns_all(sampler, small_data):
    result = sampler.reservoir_sample(small_data)
    assert result == small_data


def test_reservoir_sample_reduces_large(sampler, large_data):
    result = sampler.reservoir_sample(large_data, sample_size=50)
    assert len(result) == 50


def test_reservoir_sample_default_size(sampler, large_data):
    result = sampler.reservoir_sample(large_data)
    assert len(result) == sampler.max_sample_size


def test_reservoir_sample_exact_size(sampler):
    data = [{"x": i} for i in range(100)]
    result = sampler.reservoir_sample(data, sample_size=100)
    assert result == data


# ── stratified_sample ─────────────────────────────────────────────────────────


def test_stratified_sample_small_returns_all(sampler):
    df = pd.DataFrame([{"cat": "A", "val": i} for i in range(10)])
    result = sampler.stratified_sample(df, "cat")
    assert len(result) == len(df)


def test_stratified_sample_reduces_large(sampler):
    df = pd.DataFrame([{"cat": chr(65 + i % 5), "val": i} for i in range(500)])
    result = sampler.stratified_sample(df, "cat", sample_size=50)
    assert len(result) <= 50


def test_stratified_sample_preserves_proportions(sampler):
    # 80% A, 20% B
    data = [{"cat": "A", "val": i} for i in range(80)] + [{"cat": "B", "val": i} for i in range(20)]
    df = pd.DataFrame(data)
    result = sampler.stratified_sample(df, "cat", sample_size=20)
    counts = result["cat"].value_counts(normalize=True)
    assert counts.get("A", 0) > counts.get("B", 0)


def test_stratified_sample_default_size(sampler):
    df = pd.DataFrame([{"cat": "A", "val": i} for i in range(500)])
    result = sampler.stratified_sample(df, "cat")
    assert len(result) <= sampler.max_sample_size


def test_stratified_sample_small_stratum_taken_whole(sampler):
    # "rare" category has 1 row; sample_size=10 gives it stratum_size=1 → appended whole (line 94)
    data = [{"cat": "common", "val": i} for i in range(199)] + [{"cat": "rare", "val": 999}]
    df = pd.DataFrame(data)
    result = sampler.stratified_sample(df, "cat", sample_size=10)
    assert len(result) <= 10


def test_stratified_sample_concat_over_target_sampled_down(sampler):
    # 5 strata each of size 1, sample_size=3 → concat gives 5 > 3 → line 102 triggered
    data = [{"cat": str(i), "val": i} for i in range(5)] + [{"cat": "0", "val": 100}]
    df = pd.DataFrame(data)
    result = sampler.stratified_sample(df, "cat", sample_size=3)
    assert len(result) <= 3


# ── smart_sample ─────────────────────────────────────────────────────────────


def test_smart_sample_small_returns_all(sampler, small_data):
    result = sampler.smart_sample(small_data)
    assert result == small_data


def test_smart_sample_with_categorical(sampler):
    data = [{"cat": chr(65 + i % 5), "val": i} for i in range(500)]
    result = sampler.smart_sample(data, sample_size=50)
    assert len(result) <= 50


def test_smart_sample_without_good_categorical(sampler):
    # All unique strings — no good stratification column
    data = [{"id": str(i), "val": i} for i in range(500)]
    result = sampler.smart_sample(data, sample_size=50)
    assert len(result) == 50


def test_smart_sample_default_size(sampler):
    data = [{"val": i} for i in range(500)]
    result = sampler.smart_sample(data)
    assert len(result) <= sampler.max_sample_size


# ── get_sampling_metadata ─────────────────────────────────────────────────────


def test_sampling_metadata_sampled(sampler):
    meta = sampler.get_sampling_metadata(1000, 100)
    assert meta["original_size"] == 1000
    assert meta["sampled_size"] == 100
    assert meta["sampling_ratio"] == pytest.approx(0.1)
    assert meta["is_sampled"] is True
    assert meta["sampling_method"] == "reservoir"


def test_sampling_metadata_not_sampled(sampler):
    meta = sampler.get_sampling_metadata(50, 50)
    assert meta["is_sampled"] is False
    assert meta["sampling_method"] == "none"


def test_sampling_metadata_zero_original(sampler):
    meta = sampler.get_sampling_metadata(0, 0)
    assert meta["sampling_ratio"] == 0


# ── calculate_significance_threshold ─────────────────────────────────────────


def test_significance_threshold_very_small_sample():
    result = calculate_significance_threshold(2)
    assert result == 0.5


def test_significance_threshold_small_sample():
    result = calculate_significance_threshold(10)
    assert 0.0 < result < 1.0


def test_significance_threshold_large_sample():
    result_large = calculate_significance_threshold(1000)
    result_small = calculate_significance_threshold(10)
    assert result_large < result_small


def test_significance_threshold_custom_confidence():
    r_99 = calculate_significance_threshold(100, confidence_level=0.99)
    r_90 = calculate_significance_threshold(100, confidence_level=0.90)
    assert r_99 > r_90


def test_significance_threshold_returns_positive():
    assert calculate_significance_threshold(50) > 0
