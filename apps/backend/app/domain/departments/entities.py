"""Department domain entities."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(slots=True, kw_only=True)
class Department:
    id: UUID
    code: str
    name: str
    parent_id: UUID | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
