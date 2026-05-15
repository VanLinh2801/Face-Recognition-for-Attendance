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
