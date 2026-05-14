from __future__ import annotations

import argparse
import base64
import json
import os
import statistics
import sys
import time
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = min(len(values) - 1, int(round((pct / 100.0) * (len(values) - 1))))
    return values[index]


def summarize_ms(values: list[float]) -> dict:
    if not values:
        return {"count": 0, "avg": 0.0, "p50": 0.0, "p95": 0.0, "max": 0.0}
    return {
        "count": len(values),
        "avg": statistics.mean(values),
        "p50": percentile(values, 50),
        "p95": percentile(values, 95),
        "max": max(values),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Prepare aligned-benchmark inputs from raw images using pipeline detector/cropper."
    )
    parser.add_argument("--input-dir", required=True, help="Directory containing raw frame/image files.")
    parser.add_argument("--output-dir", required=True, help="Directory to write cropped face images.")
    parser.add_argument("--manifest", required=True, help="JSONL manifest with prepared face crops and landmarks.")
    parser.add_argument("--scrfd-model-path", help="Override SCRFD_MODEL_PATH.")
    parser.add_argument("--max-images", type=int, default=0, help="Limit number of input images; 0 means all.")
    parser.add_argument("--all-faces", action="store_true", help="Emit all detected faces instead of largest face only.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.scrfd_model_path:
        os.environ["SCRFD_MODEL_PATH"] = args.scrfd_model_path

    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root / "apps" / "pipeline"))

    import cv2  # noqa: PLC0415
    from app.processors.face_cropper import FaceCropper  # noqa: PLC0415
    from app.processors.face_detector import SCRFDFaceDetector  # noqa: PLC0415

    input_dir = Path(args.input_dir)
    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest)
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)

    image_paths = [
        path
        for path in sorted(input_dir.rglob("*"))
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    ]
    if args.max_images > 0:
        image_paths = image_paths[: args.max_images]

    detector = SCRFDFaceDetector()
    cropper = FaceCropper()
    detector_ms: list[float] = []
    cropper_ms: list[float] = []
    emitted = 0
    no_face = 0

    with manifest_path.open("w", encoding="utf-8") as manifest:
        for image_index, image_path in enumerate(image_paths, start=1):
            frame = cv2.imread(str(image_path))
            if frame is None:
                continue

            started = time.perf_counter()
            context = detector.process({"frame": frame})
            detector_ms.append((time.perf_counter() - started) * 1000)
            detections = context.get("detections", [])
            if not detections:
                no_face += 1
                continue

            if args.all_faces:
                selected = detections
            else:
                selected = [
                    max(
                        detections,
                        key=lambda item: (item["bbox"][2] - item["bbox"][0])
                        * (item["bbox"][3] - item["bbox"][1]),
                    )
                ]

            faces = [
                {
                    "track_id": f"{image_index:06d}_{face_index:02d}",
                    "bbox": detection["bbox"],
                    "score": detection["score"],
                    "kpss": detection.get("kpss"),
                    "type": "BENCHMARK",
                }
                for face_index, detection in enumerate(selected, start=1)
            ]

            started = time.perf_counter()
            crop_context = cropper.process({"frame": frame, "faces_to_emit": faces})
            cropper_ms.append((time.perf_counter() - started) * 1000)

            for face in crop_context.get("processed_faces", []):
                crop_name = f"{Path(image_path).stem}_{face['track_id']}.jpg"
                crop_path = output_dir / crop_name
                crop_path.write_bytes(base64.b64decode(face["image_b64"]))
                manifest.write(
                    json.dumps(
                        {
                            "track_id": face["track_id"],
                            "image_path": str(crop_path),
                            "kpss": face.get("kpss"),
                            "bbox": face.get("bbox"),
                            "detection_confidence": face.get("score"),
                            "source_image": str(image_path),
                        },
                        ensure_ascii=False,
                    )
                    + "\n"
                )
                emitted += 1

    summary = {
        "images": len(image_paths),
        "faces_emitted": emitted,
        "images_without_face": no_face,
        "detector_ms": summarize_ms(detector_ms),
        "cropper_ms": summarize_ms(cropper_ms),
        "manifest": str(manifest_path),
        "output_dir": str(output_dir),
    }
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
