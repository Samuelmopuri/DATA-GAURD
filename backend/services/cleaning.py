from typing import Optional
import numpy as np
import pandas as pd
from scipy import stats


def generate_cleaning_recommendations(df: pd.DataFrame) -> list[dict]:
    """
    Generate cleaning recommendations for columns with missing values.
    - If numeric: recommend 'median' if |skewness| > 1.0, else 'mean'
    - If categorical: recommend 'mode'
    """
    recommendations = []
    total_rows = len(df)
    if total_rows == 0:
        return recommendations

    for col in df.columns:
        missing_count = int(df[col].isna().sum())
        if missing_count == 0:
            continue

        missing_pct = round(float(missing_count / total_rows * 100.0), 2)
        is_numeric = pd.api.types.is_numeric_dtype(df[col])

        if is_numeric:
            valid = pd.to_numeric(df[col].dropna(), errors="coerce").dropna()
            if len(valid) >= 3:
                try:
                    sk = float(stats.skew(valid, nan_policy="omit"))
                    if np.isnan(sk):
                        sk = 0.0
                except Exception:
                    sk = 0.0
            else:
                sk = 0.0

            if abs(sk) > 1.0:
                rec_method = "median"
                reason = f"High skewness ({sk:.2f}): median imputation is robust to skewed distributions."
            else:
                rec_method = "mean"
                reason = f"Approximately symmetric distribution (skewness: {sk:.2f}): mean imputation is optimal."

            skew_val = round(sk, 4)
        else:
            rec_method = "mode"
            reason = "Categorical / non-numeric column: mode imputation preserves category distribution."
            skew_val = None

        recommendations.append({
            "column_name": str(col),
            "missing_count": missing_count,
            "missing_pct": missing_pct,
            "skewness": skew_val,
            "recommended_method": rec_method,
            "reason": reason,
        })

    return recommendations


def apply_imputation(
    df: pd.DataFrame,
    recommendations: list[dict],
    columns: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Apply recommended imputation method to specified columns (or all recommended if None).
    Returns modified copy of DataFrame.
    """
    df_copy = df.copy()
    rec_map = {r["column_name"]: r["recommended_method"] for r in recommendations}

    target_columns = columns if columns is not None else list(rec_map.keys())

    for col in target_columns:
        if col not in df_copy.columns:
            continue

        method = rec_map.get(col)
        if not method:
            # Fallback based on column type
            if pd.api.types.is_numeric_dtype(df_copy[col]):
                method = "mean"
            else:
                method = "mode"

        if method == "mean":
            mean_val = df_copy[col].mean()
            df_copy[col] = df_copy[col].fillna(mean_val)
        elif method == "median":
            med_val = df_copy[col].median()
            df_copy[col] = df_copy[col].fillna(med_val)
        elif method == "mode":
            mode_vals = df_copy[col].mode(dropna=True)
            if not mode_vals.empty:
                df_copy[col] = df_copy[col].fillna(mode_vals.iloc[0])

    return df_copy


def apply_outlier_treatment(
    df: pd.DataFrame,
    columns: list[str],
    method: str,
) -> tuple[pd.DataFrame, dict]:
    """
    Detect outliers using IQR fences:
      lower_fence = Q1 - 1.5 * IQR
      upper_fence = Q3 + 1.5 * IQR
    If method == 'cap': clip values to [lower_fence, upper_fence].
    If method == 'prune': drop rows where any specified column falls outside fences.
    Returns (cleaned_df, summary_dict).
    """
    method = method.lower().strip()
    if method not in ("cap", "prune"):
        raise ValueError("Method must be either 'cap' or 'prune'")

    df_clean = df.copy()
    summary = {}

    for col in columns:
        if col not in df_clean.columns:
            continue

        s = pd.to_numeric(df_clean[col], errors="coerce")
        valid = s.dropna()
        if valid.empty:
            continue

        q1 = float(valid.quantile(0.25))
        q3 = float(valid.quantile(0.75))
        iqr = float(q3 - q1)
        lower_fence = float(q1 - 1.5 * iqr)
        upper_fence = float(q3 + 1.5 * iqr)

        outlier_mask = (s < lower_fence) | (s > upper_fence)
        affected_count = int(outlier_mask.sum())

        summary[col] = {
            "q1": q1,
            "q3": q3,
            "iqr": iqr,
            "lower_fence": lower_fence,
            "upper_fence": upper_fence,
            "affected_count": affected_count,
        }

    if method == "cap":
        for col in columns:
            if col in summary:
                lf = summary[col]["lower_fence"]
                uf = summary[col]["upper_fence"]
                df_clean[col] = df_clean[col].clip(lower=lf, upper=uf)
    elif method == "prune":
        combined_outliers = pd.Series(False, index=df_clean.index)
        for col in columns:
            if col in summary:
                s = pd.to_numeric(df_clean[col], errors="coerce")
                lf = summary[col]["lower_fence"]
                uf = summary[col]["upper_fence"]
                combined_outliers = combined_outliers | (s < lf) | (s > uf)
        df_clean = df_clean[~combined_outliers].reset_index(drop=True)

    return df_clean, summary
