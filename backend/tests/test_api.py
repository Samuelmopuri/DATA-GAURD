import io
import os
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from main import app
from database import Base, engine, get_db

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    # Cleanup any leftover uploads if needed


def test_api_workflow():
    # 1. Create a sample CSV
    csv_data = (
        "id,name,email,phone,salary,score\n"
        "1,Alice,alice@example.com,555-123-4567,50000.0,85.5\n"
        "2,Bob,bob@corp.com,+1-555-987-6543,60000.0,92.0\n"
        "3,Charlie,,555-000-1111,,78.0\n"
        "4,David,david@domain.org,,55000.0,88.0\n"
        "5,Eve,eve@domain.org,555-222-3333,250000.0,95.0\n"
    )

    # 2. Test Upload
    files = {"file": ("test_employees.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    upload_res = client.post("/api/upload", files=files)
    assert upload_res.status_code == 200, upload_res.text
    data = upload_res.json()
    dataset_id = data["dataset"]["id"]
    assert dataset_id > 0
    assert data["dataset"]["row_count"] == 5
    assert "salary" in data["dataset"]["numeric_columns"]

    # 3. Test Exact Duplicate Upload Detection
    files_dup = {"file": ("test_employees_copy.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}
    upload_dup_res = client.post("/api/upload", files=files_dup)
    assert upload_dup_res.status_code == 200
    dup_data = upload_dup_res.json()
    assert dup_data["duplicate_alert"] is not None
    assert dup_data["duplicate_alert"]["type"] == "exact"

    dup_id = dup_data["dataset"]["id"]

    # 4. List datasets
    list_res = client.get("/api/datasets")
    assert list_res.status_code == 200
    datasets = list_res.json()
    assert len(datasets) >= 2

    # 5. Get single dataset info
    single_res = client.get(f"/api/datasets/{dataset_id}")
    assert single_res.status_code == 200
    assert single_res.json()["id"] == dataset_id

    # 6. Preview dataset
    preview_res = client.get(f"/api/datasets/{dataset_id}/preview")
    assert preview_res.status_code == 200
    rows = preview_res.json()
    assert len(rows) == 5
    assert rows[0]["name"] == "Alice"

    # 7. Analysis Profile
    profile_res = client.get(f"/api/analysis/{dataset_id}/profile")
    assert profile_res.status_code == 200
    profile_data = profile_res.json()
    assert len(profile_data["columns"]) == 6

    # 8. T-Test
    ttest_res = client.post(
        f"/api/analysis/{dataset_id}/ttest",
        json={"column1": "salary", "column2": "score"},
    )
    assert ttest_res.status_code == 200
    assert "t_statistic" in ttest_res.json()

    # 9. Distributions
    dist_res = client.get(f"/api/analysis/{dataset_id}/distributions")
    assert dist_res.status_code == 200
    dists = dist_res.json()
    assert len(dists) >= 2

    # 10. Clustering
    cluster_res = client.post(
        f"/api/analysis/{dataset_id}/cluster",
        json={"columns": ["salary", "score"], "k": 2},
    )
    assert cluster_res.status_code == 200
    assert len(cluster_res.json()["cluster_centers"]) == 2

    # 11. Cleaning Recommendations
    rec_res = client.get(f"/api/cleaning/{dataset_id}/recommendations")
    assert rec_res.status_code == 200
    recs = rec_res.json()["recommendations"]
    assert any(r["column_name"] == "salary" for r in recs)

    # 12. Imputation
    impute_res = client.post(
        f"/api/cleaning/{dataset_id}/impute",
        json={"columns": ["salary"]},
    )
    assert impute_res.status_code == 200

    # 13. Outliers Treatment (cap)
    outlier_res = client.post(
        f"/api/cleaning/{dataset_id}/outliers",
        json={"columns": ["salary"], "method": "cap"},
    )
    assert outlier_res.status_code == 200

    # 14. Privacy Scan
    scan_res = client.post(f"/api/cleaning/{dataset_id}/privacy/scan")
    assert scan_res.status_code == 200
    assert scan_res.json()["total_pii_found"] > 0

    # 15. Privacy Mask
    mask_res = client.post(f"/api/cleaning/{dataset_id}/privacy/mask")
    assert mask_res.status_code == 200
    assert mask_res.json()["masked"] is True

    # 16. Export
    export_res = client.get(f"/api/cleaning/{dataset_id}/export")
    assert export_res.status_code == 200
    assert len(export_res.content) > 0

    # 17. Clean up datasets
    client.delete(f"/api/datasets/{dataset_id}")
    client.delete(f"/api/datasets/{dup_id}")

    # Verify deleted
    not_found_res = client.get(f"/api/datasets/{dataset_id}")
    assert not_found_res.status_code == 404
