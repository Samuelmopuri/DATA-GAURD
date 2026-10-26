import numpy as np
import pandas as pd
from scipy import stats


def compute_column_stats(series: pd.Series) -> dict:
    """
    Compute comprehensive column statistics.
    Handles numeric and non-numeric columns gracefully.
    """
    total_count = len(series)
    missing_count = int(series.isna().sum())
    missing_pct = float(missing_count / total_count * 100.0) if total_count > 0 else 0.0
    valid_series = series.dropna()
    count = int(len(valid_series))

    is_numeric = pd.api.types.is_numeric_dtype(series)

    if is_numeric and count > 0:
        mean_val = float(valid_series.mean())
        median_val = float(valid_series.median())
        std_val = float(valid_series.std(ddof=1)) if count > 1 else 0.0
        var_val = float(valid_series.var(ddof=1)) if count > 1 else 0.0
        min_val = float(valid_series.min())
        max_val = float(valid_series.max())
        q1_val = float(valid_series.quantile(0.25))
        q3_val = float(valid_series.quantile(0.75))
        iqr_val = float(q3_val - q1_val)

        try:
            skew_calc = float(stats.skew(valid_series, nan_policy="omit"))
            skew_val = None if np.isnan(skew_calc) else skew_calc
        except Exception:
            skew_val = None

        mean_val = None if np.isnan(mean_val) else mean_val
        median_val = None if np.isnan(median_val) else median_val
        std_val = None if np.isnan(std_val) else std_val
        var_val = None if np.isnan(var_val) else var_val
        min_val = None if np.isnan(min_val) else min_val
        max_val = None if np.isnan(max_val) else max_val
        q1_val = None if np.isnan(q1_val) else q1_val
        q3_val = None if np.isnan(q3_val) else q3_val
        iqr_val = None if np.isnan(iqr_val) else iqr_val
    else:
        mean_val = None
        median_val = None
        std_val = None
        var_val = None
        min_val = None
        max_val = None
        q1_val = None
        q3_val = None
        iqr_val = None
        skew_val = None

    return {
        "column_name": str(series.name) if series.name is not None else "",
        "count": count,
        "mean": mean_val,
        "median": median_val,
        "std": std_val,
        "variance": var_val,
        "min": min_val,
        "max": max_val,
        "q1": q1_val,
        "q3": q3_val,
        "iqr": iqr_val,
        "skewness": skew_val,
        "missing_count": missing_count,
        "missing_pct": round(missing_pct, 2),
    }


def run_ttest(series1: pd.Series, series2: pd.Series) -> dict:
    """
    Run independent two-sample t-test between series1 and series2.
    """
    s1 = pd.to_numeric(series1.dropna(), errors="coerce").dropna()
    s2 = pd.to_numeric(series2.dropna(), errors="coerce").dropna()

    n1 = int(len(s1))
    n2 = int(len(s2))

    if n1 < 2 or n2 < 2:
        raise ValueError("Each column must have at least 2 non-null numeric values for t-test.")

    res = stats.ttest_ind(s1, s2, nan_policy="omit")
    t_stat = float(res.statistic)
    p_val = float(res.pvalue)

    if np.isnan(t_stat):
        t_stat = 0.0
    if np.isnan(p_val):
        p_val = 1.0

    reject_null = bool(p_val < 0.05)
    interpretation = (
        "Reject H₀: Statistically significant difference exists between selected columns."
        if reject_null
        else "Fail to reject H₀: Insufficient evidence of statistical difference."
    )

    return {
        "column1": str(series1.name),
        "column2": str(series2.name),
        "t_statistic": t_stat,
        "p_value": p_val,
        "alpha": 0.05,
        "reject_null": reject_null,
        "interpretation": interpretation,
        "n1": n1,
        "n2": n2,
        "mean1": float(s1.mean()),
        "mean2": float(s2.mean()),
        "std1": float(s1.std(ddof=1)) if n1 > 1 else 0.0,
        "std2": float(s2.std(ddof=1)) if n2 > 1 else 0.0,
    }


def compute_distribution(series: pd.Series, bins: int = 10) -> list[dict]:
    """
    Compute histogram distribution using pd.cut for a numeric series.
    Returns list of dicts with range_label and count.
    """
    s = pd.to_numeric(series.dropna(), errors="coerce").dropna()
    if s.empty:
        return []

    if s.nunique() <= 1:
        val = float(s.iloc[0])
        return [{"range_label": f"[{val:.2f}, {val:.2f}]", "count": int(len(s))}]

    binned = pd.cut(s, bins=bins, include_lowest=True)
    counts = binned.value_counts(sort=False)

    distribution = []
    for interval, count in counts.items():
        label = f"[{interval.left:.2f}, {interval.right:.2f}]"
        distribution.append({"range_label": label, "count": int(count)})

    return distribution
