import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


def compute_jaccard_similarity(cols_a: list[str], cols_b: list[str]) -> float:
    """Compute Jaccard similarity index between two column lists."""
    set_a = set(cols_a)
    set_b = set(cols_b)
    union = set_a.union(set_b)
    if not union:
        return 0.0
    intersection = set_a.intersection(set_b)
    return float(len(intersection) / len(union))


def compute_cosine_similarity_profile(
    df_a: pd.DataFrame, df_b: pd.DataFrame
) -> tuple[float, dict]:
    """
    Find shared numeric columns (at least 50% overlap required, else return (0.0, {})).
    For each shared numeric column, build feature vector [mean, std, IQR].
    Flatten into vectors u, v and compute cosine similarity.
    Return (similarity_score, {col: {mean_diff, std_diff, iqr_diff}}).
    """
    num_a = set(df_a.select_dtypes(include=[np.number]).columns)
    num_b = set(df_b.select_dtypes(include=[np.number]).columns)

    if not num_a or not num_b:
        return 0.0, {}

    shared = sorted(list(num_a.intersection(num_b)))
    overlap_ratio = len(shared) / max(len(num_a), len(num_b))
    if overlap_ratio < 0.5:
        return 0.0, {}

    u = []
    v = []
    diffs = {}

    for col in shared:
        sa = df_a[col].dropna()
        sb = df_b[col].dropna()

        mean_a = float(sa.mean()) if not sa.empty else 0.0
        std_a = float(sa.std(ddof=1)) if len(sa) > 1 else 0.0
        iqr_a = (
            float(sa.quantile(0.75) - sa.quantile(0.25))
            if not sa.empty
            else 0.0
        )

        mean_b = float(sb.mean()) if not sb.empty else 0.0
        std_b = float(sb.std(ddof=1)) if len(sb) > 1 else 0.0
        iqr_b = (
            float(sb.quantile(0.75) - sb.quantile(0.25))
            if not sb.empty
            else 0.0
        )

        # Handle any possible NaN
        mean_a = 0.0 if np.isnan(mean_a) else mean_a
        std_a = 0.0 if np.isnan(std_a) else std_a
        iqr_a = 0.0 if np.isnan(iqr_a) else iqr_a

        mean_b = 0.0 if np.isnan(mean_b) else mean_b
        std_b = 0.0 if np.isnan(std_b) else std_b
        iqr_b = 0.0 if np.isnan(iqr_b) else iqr_b

        u.extend([mean_a, std_a, iqr_a])
        v.extend([mean_b, std_b, iqr_b])

        diffs[col] = {
            "mean_diff": abs(mean_a - mean_b),
            "std_diff": abs(std_a - std_b),
            "iqr_diff": abs(iqr_a - iqr_b),
        }

    u_vec = np.array(u).reshape(1, -1)
    v_vec = np.array(v).reshape(1, -1)

    norm_u = np.linalg.norm(u_vec)
    norm_v = np.linalg.norm(v_vec)

    if norm_u == 0.0 or norm_v == 0.0:
        # If both are entirely zero vectors, they are identical profiles
        if norm_u == 0.0 and norm_v == 0.0:
            return 1.0, diffs
        return 0.0, diffs

    sim = float(cosine_similarity(u_vec, v_vec)[0][0])
    if np.isnan(sim):
        sim = 0.0

    return max(0.0, min(1.0, sim)), diffs
