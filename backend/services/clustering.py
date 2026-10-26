import numpy as np
import pandas as pd
from sklearn.cluster import KMeans


def run_kmeans_outlier_detection(df: pd.DataFrame, columns: list[str], k: int = 3) -> dict:
    """
    Fit KMeans on selected columns, compute Euclidean distances to centroids,
    flag records with distance > 2.5 * std as outliers.
    """
    subset = df[columns].apply(pd.to_numeric, errors="coerce").dropna()
    if len(subset) < k:
        raise ValueError(f"Need at least {k} non-null rows for {k} clusters")

    kmeans = KMeans(n_clusters=k, n_init=10, random_state=42)
    values = subset.values.astype(float)
    labels = kmeans.fit_predict(values)
    centers = kmeans.cluster_centers_

    distances = []
    for i, (idx, row) in enumerate(subset.iterrows()):
        center = centers[labels[i]]
        dist = np.sqrt(np.sum((row.values.astype(float) - center) ** 2))
        distances.append({
            "row_idx": int(idx),
            "cluster": int(labels[i]),
            "distance": float(dist),
        })

    all_dists = np.array([d["distance"] for d in distances])
    mean_dist = float(np.mean(all_dists))
    std_dist = float(np.std(all_dists))
    threshold = float(mean_dist + 2.5 * std_dist)

    outlier_indices = []
    for d in distances:
        is_out = bool(d["distance"] > threshold)
        d["is_outlier"] = is_out
        if is_out:
            outlier_indices.append(d["row_idx"])

    return {
        "columns": columns,
        "k": k,
        "cluster_centers": centers.tolist(),
        "outliers": outlier_indices,
        "outlier_threshold": threshold,
        "inertia": float(kmeans.inertia_),
        "records": distances,
    }
