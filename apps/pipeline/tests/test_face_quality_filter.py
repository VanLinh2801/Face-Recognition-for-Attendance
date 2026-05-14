from __future__ import annotations

import sys
import types


cv2_mod = types.ModuleType("cv2")
cv2_mod.COLOR_BGR2GRAY = 0
cv2_mod.CV_64F = 0
sys.modules.setdefault("cv2", cv2_mod)

pydantic_settings_mod = types.ModuleType("pydantic_settings")


class _BaseSettings:
    def __init__(self) -> None:
        for cls in reversed(self.__class__.mro()):
            for key, value in getattr(cls, "__dict__", {}).items():
                if key.isupper():
                    setattr(self, key, value)


pydantic_settings_mod.BaseSettings = _BaseSettings
sys.modules.setdefault("pydantic_settings", pydantic_settings_mod)

from app.processors.face_quality_filter import FaceQualityFilter


def _filter() -> FaceQualityFilter:
    quality_filter = FaceQualityFilter()
    quality_filter.min_face_size = 48
    quality_filter.require_full_kps = True
    quality_filter.min_kps_dist = 2.0
    quality_filter.max_yaw_deg = 45.0
    return quality_filter


def test_full_kps_rejects_wrong_left_right_order() -> None:
    quality_filter = _filter()
    face = {
        "track_id": "t1",
        "bbox": [10, 10, 110, 110],
        "kpss": [
            [80, 35],
            [40, 35],
            [60, 60],
            [45, 85],
            [75, 85],
        ],
    }

    assert quality_filter._check_full_kps(face) is False


def test_face_angle_clamps_unstable_yaw_to_valid_degree_range() -> None:
    quality_filter = _filter()
    face = {
        "track_id": "t1",
        "bbox": [0, 0, 200, 200],
        "kpss": [
            [50, 60],
            [100, 60],
            [200, 80],
            [55, 130],
            [95, 130],
        ],
    }

    assert quality_filter._check_face_angle(face) is False
    assert face["_quality_yaw_deg"] == 90.0
