from dataclasses import dataclass
from enum import Enum
from typing import Optional


class RecognitionDecision(str, Enum):
    KNOWN = "known"       # face matched a registered person
    UNKNOWN = "unknown"   # no match above threshold
    SPOOFED = "spoofed"   # anti-spoof check failed → do NOT publish event


@dataclass
class MatchDetail:
    """Details of the best vector search match."""
    person_id: str
    face_registration_id: str
    match_score: float  # cosine similarity [0, 1]


@dataclass
class RecognitionResult:
    """
    Final decision for a single face.
    Produced by IdentifyFacesUseCase and consumed by the event handler.
    """
    track_id: str
    decision: RecognitionDecision
    spoof_score: Optional[float] = None   # real-face probability [0, 1]
    match: Optional[MatchDetail] = None   # populated when decision == KNOWN or best candidate for UNKNOWN
