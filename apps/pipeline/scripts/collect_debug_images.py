"""
Script nhặt ảnh từ Redis stream pipeline_ai.
Chỉ capture những ảnh bắt đầu từ lúc chạy script.
Lưu vào folder: debug_images/new_data/{data_date}/
"""
import redis
import json
import base64
import argparse
from datetime import datetime
from pathlib import Path
from uuid import uuid4


def main():
    parser = argparse.ArgumentParser(description="Collect face images from Redis pipeline_ai stream")
    parser.add_argument("--redis-url", default="redis://localhost:6379", help="Redis URL")
    parser.add_argument("--stream", default="pipeline_ai", help="Redis stream name")
    parser.add_argument("--group", default="debug_collector", help="Consumer group name")
    parser.add_argument("--consumer", default=None, help="Consumer name (auto-generated if not provided)")
    parser.add_argument("--output-dir", default="debug_images/new_data", help="Output directory")
    parser.add_argument("--batch-size", type=int, default=10, help="Batch size for reading")
    args = parser.parse_args()

    # Generate consumer name if not provided
    consumer_name = args.consumer or f"debug_collector_{uuid4().hex[:8]}"

    # Setup output directory
    today = datetime.now().strftime("%Y%m%d")
    output_dir = Path(args.output_dir) / today
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] Output directory: {output_dir}")
    print(f"[INFO] Stream: {args.stream}, Group: {args.group}, Consumer: {consumer_name}")

    # Connect to Redis
    r = redis.from_url(args.redis_url, decode_responses=True)

    # Create consumer group if not exists
    try:
        r.xgroup_create(args.stream, args.group, id="0", mkstream=True)
        print(f"[INFO] Created consumer group: {args.group}")
    except redis.ResponseError as e:
        if "already exists" not in str(e):
            raise
        print(f"[INFO] Consumer group already exists: {args.group}")

    # Track statistics
    total_images = 0
    total_frames = 0

    print("[INFO] Starting to collect images... Press Ctrl+C to stop.")

    try:
        while True:
            # Read new messages from stream
            messages = r.xreadgroup(
                args.group,
                consumer_name,
                {args.stream: ">"},
                count=args.batch_size,
                block=5000  # 5 seconds timeout
            )

            for stream_name, entries in messages:
                for entry_id, data in entries:
                    try:
                        envelope_str = data.get("envelope", "{}")
                        envelope = json.loads(envelope_str)

                        # Extract face images
                        payload = envelope.get("payload", {})
                        faces = payload.get("faces", [])

                        for face in faces:
                            face_b64 = face.get("cropped_face_b64")
                            if face_b64:
                                # Decode base64
                                image_data = base64.b64decode(face_b64)

                                # Generate filename
                                track_id = face.get("track_id", "unknown")
                                frame_seq = face.get("frame_sequence", 0)
                                timestamp = datetime.now().strftime("%H%M%S_%f")
                                filename = f"{track_id}_f{frame_seq}_{timestamp}.jpg"

                                # Save image
                                filepath = output_dir / filename
                                with open(filepath, "wb") as f:
                                    f.write(image_data)

                                total_images += 1

                        total_frames += 1

                        # Acknowledge message
                        r.xack(args.stream, args.group, entry_id)

                        # Log progress every 100 messages
                        if total_frames % 100 == 0:
                            print(f"[INFO] Collected: {total_images} images from {total_frames} frames")

                    except Exception as e:
                        print(f"[ERROR] Failed to process message {entry_id}: {e}")
                        continue

    except KeyboardInterrupt:
        print(f"\n[INFO] Stopped. Total: {total_images} images from {total_frames} frames")
    finally:
        r.close()


if __name__ == "__main__":
    main()
