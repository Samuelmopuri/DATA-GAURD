import hashlib
import numpy as np
import pandas as pd
import pytest

from services.cleaning import (
    apply_imputation,
    apply_outlier_treatment,
    generate_cleaning_recommendations,
)
from services.clustering import run_kmeans_outlier_detection
from services.duplicate_detection import (
    compute_cosine_similarity_profile,
    compute_jaccard_similarity,
)
from services.hashing import compute_sha256
from services.privacy import mask_pii, scan_pii
from services.statistics import (
    compute_column_stats,
    compute_distribution,
    run_ttest,
)


def test_sha256_computation():
    """1. Test SHA-256 hash computation produces correct 64-char hex."""
    sample_data = b"DataGuard integrity test payload " * 100
    expected_hash = hashlib.sha256(sample_data).hexdigest()
    computed_hash = compute_sha256(sample_data)

    assert len(computed_hash) == 64
    assert computed_hash == expected_hash

    # Test chunked streaming with larger payload (> 64KB)
    large_payload = b"X" * (65536 * 3 + 123)
    large_expected = hashlib.sha256(large_payload).hexdigest()
    large_computed = compute_sha256(large_payload)
    assert large_computed == large_expected


def test_jaccard_similarity():
    """2. Test Jaccard similarity index on known sets."""
    cols_a = ["id", "name", "email", "age"]
    cols_b = ["id", "name", "phone", "salary"]

    # Intersection: {id, name} = 2, Union: {id, name, email, age, phone, salary} = 6
    sim = compute_jaccard_similarity(cols_a, cols_b)
    assert pytest.approx(sim, 0.001) == 2 / 6

    # Identical sets
    assert compute_jaccard_similarity(["a", "b"], ["a", "b"]) == 1.0

    # Disjoint sets
    assert compute_jaccard_similarity(["a", "b"], ["c", "d"]) == 0.0

    # Empty sets
    assert compute_jaccard_similarity([], []) == 0.0


def test_cosine_similarity_profiles():
    """3. Test Cosine similarity on known numeric profiles."""
    df1 = pd.DataFrame({
        "score": [10.0, 20.0, 30.0, 40.0],
        "rating": [1.0, 2.0, 3.0, 4.0],
    })
    df2 = pd.DataFrame({
        "score": [10.0, 20.0, 30.0, 40.0],
        "rating": [1.0, 2.0, 3.0, 4.0],
    })

    sim, diffs = compute_cosine_similarity_profile(df1, df2)
    assert pytest.approx(sim, 0.001) == 1.0
    assert diffs["score"]["mean_diff"] == 0.0
    assert diffs["rating"]["std_diff"] == 0.0

    # Test insufficient overlap (< 50%)
    df3 = pd.DataFrame({"a": [1, 2], "b": [3, 4], "c": [5, 6]})
    df4 = pd.DataFrame({"a": [1, 2], "x": [3, 4], "y": [5, 6]})
    # Shared: 'a' (1 out of 3 columns = 33.3% < 50%)
    low_overlap_sim, _ = compute_cosine_similarity_profile(df3, df4)
    assert low_overlap_sim == 0.0


def test_column_stats_computation():
    """4. Test column stats computation (mean, median, IQR, etc.)."""
    series = pd.Series([10.0, 20.0, 30.0, 40.0, 50.0, np.nan], name="test_col")
    stats = compute_column_stats(series)

    assert stats["column_name"] == "test_col"
    assert stats["count"] == 5
    assert stats["missing_count"] == 1
    assert pytest.approx(stats["mean"], 0.001) == 30.0
    assert pytest.approx(stats["median"], 0.001) == 30.0
    assert stats["min"] == 10.0
    assert stats["max"] == 50.0
    assert pytest.approx(stats["q1"], 0.001) == 20.0
    assert pytest.approx(stats["q3"], 0.001) == 40.0
    assert pytest.approx(stats["iqr"], 0.001) == 20.0
    assert stats["skewness"] is not None

    # Test categorical column gracefully handled
    cat_series = pd.Series(["apple", "banana", "apple", None], name="fruits")
    cat_stats = compute_column_stats(cat_series)
    assert cat_stats["count"] == 3
    assert cat_stats["missing_count"] == 1
    assert cat_stats["mean"] is None
    assert cat_stats["median"] is None


def test_ttest_significant_and_nonsignificant():
    """5. Test t-test for both significant and non-significant cases."""
    # Clearly different distributions
    s1 = pd.Series([1.0, 2.0, 1.5, 2.5, 1.8, 2.2, 1.9, 2.1], name="group_a")
    s2 = pd.Series([100.0, 102.0, 101.5, 102.5, 100.8, 101.2, 100.9, 101.1], name="group_b")

    res_sig = run_ttest(s1, s2)
    assert res_sig["reject_null"] is True
    assert res_sig["p_value"] < 0.05
    assert "Reject H₀" in res_sig["interpretation"]

    # Identical distributions
    s3 = pd.Series([10.0, 12.0, 11.0, 10.5, 11.5, 12.0], name="sample1")
    s4 = pd.Series([10.0, 12.0, 11.0, 10.5, 11.5, 12.0], name="sample2")

    res_nonsig = run_ttest(s3, s4)
    assert res_nonsig["reject_null"] is False
    assert res_nonsig["p_value"] >= 0.05
    assert "Fail to reject H₀" in res_nonsig["interpretation"]


def test_skewness_cleaning_recommendations():
    """6. Test skewness-based recommendation logic."""
    # All columns have exactly 20 elements and at least 1 missing value
    skewed_vals = [1.0] * 15 + [500.0, 1000.0] + [np.nan, np.nan, np.nan]
    symmetric_vals = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0] * 3 + [np.nan, np.nan]
    category_vals = ["admin", "user", "guest", None] * 5

    df = pd.DataFrame({
        "skewed": skewed_vals,
        "symmetric": symmetric_vals,
        "role": category_vals,
    })

    recs = generate_cleaning_recommendations(df)
    rec_dict = {r["column_name"]: r for r in recs}

    assert "skewed" in rec_dict
    assert rec_dict["skewed"]["recommended_method"] == "median"
    assert "symmetric" in rec_dict
    assert rec_dict["symmetric"]["recommended_method"] == "mean"
    assert "role" in rec_dict
    assert rec_dict["role"]["recommended_method"] == "mode"

    # Test imputation execution
    cleaned_df = apply_imputation(df, recs)
    assert cleaned_df["skewed"].isna().sum() == 0
    assert cleaned_df["symmetric"].isna().sum() == 0
    assert cleaned_df["role"].isna().sum() == 0


def test_pii_detection_and_masking():
    """7. Test PII regex detection and masking for email and phone numbers."""
    df = pd.DataFrame({
        "contact_info": [
            "Contact user at support@company.org or +1-555-123-4567.",
            "Personal phone: (123) 456-7890, email john.doe@mail.com",
            "Safe row with no PII here.",
        ],
        "notes": ["Call 800-555-0199 for assistance.", "Nothing here", None],
    })

    scan_res = scan_pii(df)
    res_map = {r["column_name"]: r for r in scan_res}

    assert res_map["contact_info"]["emails_found"] == 2
    assert res_map["contact_info"]["phones_found"] == 2
    assert res_map["contact_info"]["total_pii"] == 4
    assert res_map["notes"]["phones_found"] == 1
    assert res_map["notes"]["emails_found"] == 0

    # Masking test
    masked_df = mask_pii(df)
    row0 = masked_df["contact_info"].iloc[0]
    assert "s***@company.org" in row0
    assert "+1-***-***-4567" in row0
    assert "support@company.org" not in row0

    row1 = masked_df["contact_info"].iloc[1]
    assert "j***@mail.com" in row1
    assert "***-***-7890" in row1


def test_iqr_outlier_detection_and_treatment():
    """8. Test IQR fence calculation and capping/pruning."""
    # Data from 10 to 14, with extreme outlier 100
    df = pd.DataFrame({"score": [10.0, 11.0, 12.0, 13.0, 14.0, 100.0]})

    # Test Cap
    df_capped, summary_cap = apply_outlier_treatment(df, ["score"], method="cap")
    assert summary_cap["score"]["affected_count"] == 1
    upper_fence = summary_cap["score"]["upper_fence"]
    assert df_capped["score"].max() <= upper_fence
    assert len(df_capped) == 6

    # Test Prune
    df_pruned, summary_prune = apply_outlier_treatment(df, ["score"], method="prune")
    assert len(df_pruned) == 5
    assert 100.0 not in df_pruned["score"].values


def test_kmeans_clustering():
    """9. Test KMeans clustering and outlier detection structure."""
    np.random.seed(42)
    # 2 dense clusters + 1 point placed midway that is far from both centers
    c1 = np.random.normal(loc=0.0, scale=0.1, size=(50, 2))
    c2 = np.random.normal(loc=20.0, scale=0.1, size=(50, 2))
    outlier = np.array([[10.0, 10.0]])
    data = np.vstack([c1, c2, outlier])

    df = pd.DataFrame(data, columns=["feat_x", "feat_y"])
    res = run_kmeans_outlier_detection(df, ["feat_x", "feat_y"], k=2)

    assert res["k"] == 2
    assert len(res["cluster_centers"]) == 2
    assert len(res["records"]) == 101
    assert "inertia" in res
    assert res["inertia"] > 0
    assert "outlier_threshold" in res
    assert 100 in res["outliers"]  # Row 100 is the outlier


def test_distribution_computation():
    """10. Test compute_distribution histogram binning."""
    series = pd.Series([1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0])
    bins = compute_distribution(series, bins=5)
    assert len(bins) == 5
    total_count = sum(b["count"] for b in bins)
    assert total_count == 10
