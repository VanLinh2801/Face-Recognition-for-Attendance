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
    quality_filter.min_face_size = 90
    quality_filter.require_full_kps = True
    quality_filter.min_kps_dist = 2.0
    quality_filter.max_yaw_deg = 45.0
    quality_filter.min_sharpness = 100.0
    return quality_filter


def test_min_sharpness_defaults_to_100() -> None:
    assert _filter().min_sharpness == 100.0


def test_min_face_size_rejects_faces_below_90_px() -> None:
    quality_filter = _filter()
    face = {
        "track_id": "t1",
        "bbox": [10, 10, 99, 130],
        "kpss": [
            [35, 45],
            [75, 45],
            [55, 70],
            [40, 100],
            [70, 100],
        ],
    }

    assert quality_filter._check_min_size(face) is False


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


def test_full_kps_rejects_collapsed_mouth_points() -> None:
    quality_filter = _filter()
    face = {
        "track_id": "t1",
        "bbox": [10, 10, 110, 110],
        "kpss": [
            [35, 35],
            [85, 35],
            [60, 60],
            [58, 85],
            [62, 85],
        ],
    }

    assert quality_filter._check_full_kps(face) is False


def test_full_kps_rejects_nose_too_close_to_one_eye() -> None:
    quality_filter = _filter()
    face = {
        "track_id": "t1",
        "bbox": [10, 10, 130, 130],
        "kpss": [
            [45, 45],
            [95, 45],
            [88, 75],
            [50, 105],
            [90, 105],
        ],
    }

    assert quality_filter._check_full_kps(face) is False


def test_filter_process_only_passes_quality_faces() -> None:
    quality_filter = _filter()
    good_face = {
        "track_id": "good",
        "bbox": [10, 10, 130, 130],
        "kpss": [
            [45, 45],
            [95, 45],
            [70, 75],
            [50, 105],
            [90, 105],
        ],
        "type": "NEW",
    }
    bad_face = {
        "track_id": "bad",
        "bbox": [200, 10, 260, 130],
        "kpss": [
            [220, 45],
            [240, 45],
            [230, 75],
            [222, 105],
            [238, 105],
        ],
        "type": "NEW",
    }

    context = quality_filter.process({
        "faces_to_emit": [good_face, bad_face],
        "frame_width": 320,
        "frame_height": 180,
        "frame_sequence": 1,
    })

    assert [face["track_id"] for face in context["filtered_faces"]] == ["good"]


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
