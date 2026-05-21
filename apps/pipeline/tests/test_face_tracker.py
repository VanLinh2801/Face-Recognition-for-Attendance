from __future__ import annotations

import sys
import types


pydantic_settings_mod = types.ModuleType("pydantic_settings")


class _BaseSettings:
    def __init__(self) -> None:
        for cls in reversed(self.__class__.mro()):
            for key, value in getattr(cls, "__dict__", {}).items():
                if key.isupper():
                    setattr(self, key, value)


pydantic_settings_mod.BaseSettings = _BaseSettings
sys.modules.setdefault("pydantic_settings", pydantic_settings_mod)

from app.processors.face_tracker import FaceTracker


def test_tracker_emits_five_initial_quality_passes_before_cooldown() -> None:
    tracker = FaceTracker()
    tracker.max_initial = 5
    tracker.cooldown = 3600
    detection = {
        "bbox": [10.0, 10.0, 120.0, 120.0],
        "score": 0.95,
        "kpss": [[40, 45], [90, 45], [65, 70], [45, 100], [85, 100]],
    }

    emitted_types = []
    for frame_sequence in range(1, 6):
        context = tracker.process({"detections": [detection]})
        assert len(context["faces_to_emit"]) == 1
        face = context["faces_to_emit"][0]
        emitted_types.append(face["type"])
        tracker.sync_filter_passed({face["track_id"]: frame_sequence})

    context = tracker.process({"detections": [detection]})

    assert emitted_types == ["NEW", "INITIAL", "INITIAL", "INITIAL", "INITIAL"]
    assert context["faces_to_emit"] == []


def test_tracker_expires_stale_track_before_matching_new_detection(monkeypatch) -> None:
    now = 1000.0
    monkeypatch.setattr("app.processors.face_tracker.time.time", lambda: now)

    tracker = FaceTracker()
    tracker.max_age = 1.0
    tracker.max_initial = 1
    tracker.cooldown = 3600
    detection = {
        "bbox": [10.0, 10.0, 120.0, 120.0],
        "score": 0.95,
        "kpss": [[40, 45], [90, 45], [65, 70], [45, 100], [85, 100]],
    }

    first_context = tracker.process({"detections": [detection]})
    first_face = first_context["faces_to_emit"][0]
    tracker.sync_filter_passed({first_face["track_id"]: 1})

    now = 1002.0
    second_context = tracker.process({"detections": [detection]})
    second_face = second_context["faces_to_emit"][0]

    assert second_face["type"] == "NEW"
    assert second_face["track_id"] != first_face["track_id"]


def test_tracker_prune_expired_clears_tracks_without_detections(monkeypatch) -> None:
    now = 2000.0
    monkeypatch.setattr("app.processors.face_tracker.time.time", lambda: now)

    tracker = FaceTracker()
    tracker.max_age = 1.0
    detection = {
        "bbox": [10.0, 10.0, 120.0, 120.0],
        "score": 0.95,
        "kpss": [[40, 45], [90, 45], [65, 70], [45, 100], [85, 100]],
    }
    tracker.process({"detections": [detection]})
    assert tracker.tracks

    now = 2002.0
    tracker.prune_expired()

    assert tracker.tracks == {}


def test_tracker_drops_no_pass_track_after_reject_timeout(monkeypatch) -> None:
    now = 3000.0
    monkeypatch.setattr("app.processors.face_tracker.time.time", lambda: now)

    tracker = FaceTracker()
    tracker.no_pass_max_age = 1.0
    detection = {
        "bbox": [10.0, 10.0, 120.0, 120.0],
        "score": 0.95,
        "kpss": [[40, 45], [90, 45], [65, 70], [45, 100], [85, 100]],
    }

    first_context = tracker.process({"detections": [detection]})
    track_id = first_context["faces_to_emit"][0]["track_id"]
    tracker.sync_filter_rejected({track_id: 1})
    assert track_id in tracker.tracks

    now = 3001.1
    tracker.sync_filter_rejected({track_id: 2})

    assert track_id not in tracker.tracks
