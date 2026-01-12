from __future__ import annotations

from sqlalchemy import Column, Integer, Float, String, Text
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Snapshot(Base):
    __tablename__ = "snapshots"
    id = Column(Integer, primary_key=True)
    t = Column(Float, nullable=False)
    payload = Column(Text, nullable=False)


class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True)
    t = Column(Float, nullable=False)
    elapsed_ms = Column(Float, nullable=False)
    steps = Column(Integer, nullable=False)
    note = Column(String(64), nullable=True)
