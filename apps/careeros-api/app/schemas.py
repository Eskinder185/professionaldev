"""Response models. Routes return these, never ORM objects."""

from __future__ import annotations

from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class CompanyOut(ORMModel):
    id: int
    name: str
    website: str | None = None


class StatusEventOut(ORMModel):
    id: int
    from_status: str | None
    to_status: str | None
    observed_text: str | None
    source: str
    confidence: str
    evidence: str | None
    observed_at: datetime


class ApplicationOut(ORMModel):
    id: int
    title: str
    company: CompanyOut
    job_url: str | None
    platform: str
    location: str | None
    salary_text: str | None
    status: str
    applied_at: date | None
    match_score: int | None
    created_at: datetime
    updated_at: datetime
    last_activity_at: datetime


class ApplicationDetail(ApplicationOut):
    requisition_id: str | None
    description: str | None
    notes: str | None
    events: list[StatusEventOut]


class HealthOut(BaseModel):
    status: str
    database: str


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorOut(BaseModel):
    error: ErrorBody
