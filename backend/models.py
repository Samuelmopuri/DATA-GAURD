from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, String, Text

try:
    from .database import Base
except ImportError:
    from database import Base


class DatasetRecord(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    filename = Column(String, nullable=False)
    sha256_hash = Column(String(64), nullable=False, index=True)
    file_size = Column(Integer, nullable=False)
    row_count = Column(Integer, nullable=False)
    col_count = Column(Integer, nullable=False)
    columns_json = Column(Text, nullable=False)
    numeric_columns_json = Column(Text, nullable=False)
    uploaded_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    storage_path = Column(String, nullable=False)
