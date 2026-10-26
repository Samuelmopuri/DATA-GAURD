import hashlib


def compute_sha256(file_bytes: bytes) -> str:
    """Compute SHA-256 hex digest from file bytes using 64KB chunked streaming."""
    sha256 = hashlib.sha256()
    chunk_size = 65536  # 64KB
    offset = 0
    while offset < len(file_bytes):
        sha256.update(file_bytes[offset:offset + chunk_size])
        offset += chunk_size
    return sha256.hexdigest()
