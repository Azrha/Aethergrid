from __future__ import annotations

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DEFAULT_DB_DIR = Path.home() / ".mythos"
DEFAULT_DB_DIR.mkdir(parents=True, exist_ok=True)
DB_URL = os.getenv("DATABASE_URL", f"sqlite:///{(DEFAULT_DB_DIR / 'data.sqlite3').as_posix()}")

if DB_URL.startswith("sqlite:///"):
    db_path = Path(DB_URL.replace("sqlite:///", "", 1)).resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(DB_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
