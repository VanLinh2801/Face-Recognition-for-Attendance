import redis
import base64
import json
import os
import time
from datetime import datetime

# Cấu hình Redis
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
STREAM_NAME = 'pipeline_ai'
OUTPUT_DIR = 'debug_images'
LOG_FILE = 'debug_images/confidence_log.txt'
DATA_DIR = 'debug_images/training_data'

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)


def write_confidence_log(filename: str, entries: list, mode='append'):
    """Ghi confidence log ra file txt."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    mode_w = 'w' if mode == 'write' else 'a'
    with open(filename, mode_w, encoding='utf-8') as f:
        if mode == 'write':
            f.write(f"\n=== Training Data Log - Started at {timestamp} ===\n")
            f.write(f"{'timestamp':<25} | {'track_id':<20} | {'frame_seq':<10} | {'SCRFD_det_conf':<15}\n")
            f.write("-" * 90 + "\n")
        for entry in entries:
            f.write(f"{entry}\n")


def process_message(msg_id: str, data: dict, counter: int) -> dict:
    """Parse message và trả về data cần thiết."""
    envelope_str = data.get('envelope')
    if not envelope_str:
        return None

    try:
        envelope = json.loads(envelope_str)
    except json.JSONDecodeError:
        print(f"[!] JSON decode error for message {msg_id}")
        return None

    inner = envelope.get('payload', {})
    timestamp = envelope.get('occurred_at', datetime.now().isoformat())
    stream_id = inner.get('stream_id', '')
    frame_seq = inner.get('frame_sequence', '')
    faces = inner.get('faces', [])

    results = []
    for face in faces:
        track_id = face.get('track_id', 'unknown')
        det_conf = face.get('detection_confidence', None)

        # Save cropped face image với confidence trong tên file
        img_b64 = face.get('cropped_face_b64')
        if img_b64:
            img_data = base64.b64decode(img_b64)
            conf_str = f"{det_conf:.4f}" if det_conf is not None else "0"
            filename = os.path.join(DATA_DIR, f"{track_id}_{frame_seq}_c{conf_str}.jpg")
            with open(filename, 'wb') as f:
                f.write(img_data)

        results.append({
            'msg_id': msg_id,
            'timestamp': timestamp,
            'stream_id': stream_id,
            'frame_seq': frame_seq,
            'track_id': track_id,
            'det_conf': det_conf,
            'saved': img_b64 is not None
        })

    return {
        'timestamp': timestamp,
        'stream_id': stream_id,
        'frame_seq': frame_seq,
        'faces': results
    }


def listen_stream(block_ms: int = 5000):
    """Listen liên tục vào Redis stream, bắt tất cả messages."""
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    # Kiểm tra stream tồn tại
    try:
        info = r.type(STREAM_NAME)
        if info != 'stream':
            print(f"[!] Key '{STREAM_NAME}' không phải stream (type={info})")
            return
    except redis.ResponseError:
        print(f"[!] Stream '{STREAM_NAME}' chưa tồn tại.")
        return

    print(f"[*] Đang lắng nghe stream: {STREAM_NAME} (blocking {block_ms}ms)...")
    print(f"[*] Ảnh crop sẽ được lưu vào: {os.path.abspath(DATA_DIR)}")
    print(f"[*] Log sẽ được ghi vào: {os.path.abspath(LOG_FILE)}")
    print("[*] Nhấn Ctrl+C để dừng\n")

    # Start ID - bắt đầu từ đầu stream
    last_id = '0-0'
    all_entries = []
    total_faces = 0
    start_time = time.time()

    # Flush log file khi bắt đầu
    write_confidence_log(LOG_FILE, [], mode='write')

    try:
        while True:
            # XREAD blocking - đọc messages mới
            results = r.xread({STREAM_NAME: last_id}, block=block_ms)

            if not results:
                # Throttle output
                elapsed = time.time() - start_time
                if elapsed > 30:
                    print(f"[*] Listening... (đã bắt {total_faces} faces trong {int(elapsed)}s)")
                    start_time = time.time()
                continue

            for stream_name, messages in results:
                for msg_id, data in messages:
                    # Update last_id để không đọc lại
                    # Parse ID: "123456789-0" -> lấy phần cuối
                    last_id = msg_id

                    result = process_message(msg_id, data, total_faces)
                    if not result:
                        continue

                    # Ghi log
                    for face in result['faces']:
                        if face['det_conf'] is not None:
                            entry = (
                                f"{face['timestamp']:<25} | "
                                f"{face['track_id']:<20} | "
                                f"{face['frame_seq']:<10} | "
                                f"{face['det_conf']:.6f}"
                            )
                            all_entries.append(entry)
                            total_faces += 1

                            # Print real-time
                            print(
                                f"[{datetime.now().strftime('%H:%M:%S')}] "
                                f"track_id={face['track_id']} | "
                                f"frame_seq={face['frame_seq']} | "
                                f"SCRFD_det_conf={face['det_conf']:.4f}"
                            )

                    # Flush log file định kỳ (mỗi 100 entries)
                    if len(all_entries) >= 100:
                        write_confidence_log(LOG_FILE, all_entries, mode='append')
                        all_entries = []
                        print(f"[*] Đã flush {total_faces} entries ra log file")

    except KeyboardInterrupt:
        print("\n[*] Dừng listener...")
    finally:
        # Flush remaining entries
        if all_entries:
            write_confidence_log(LOG_FILE, all_entries, mode='append')
        print(f"[✓] Hoàn thành. Tổng: {total_faces} faces đã log vào {LOG_FILE}")


def replay_history(count: int = None):
    """Đọc tất cả messages đã có trong stream (history)."""
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

    try:
        info = r.type(STREAM_NAME)
        if info != 'stream':
            print(f"[!] Key '{STREAM_NAME}' không phải stream (type={info})")
            return
    except redis.ResponseError:
        print(f"[!] Stream '{STREAM_NAME}' chưa tồn tại.")
        return

    # Lấy thông tin stream
    stream_len = r.xlen(STREAM_NAME)
    print(f"[*] Stream '{STREAM_NAME}' có {stream_len} messages")

    if count is None:
        count = stream_len

    print(f"[*] Đang đọc {count} messages cuối cùng...")

    messages = r.xrevrange(STREAM_NAME, max='+', min='-', count=count)
    print(f"[+] Tìm thấy {len(messages)} messages")

    all_entries = []
    total_faces = 0

    for i, (msg_id, data) in enumerate(messages):
        result = process_message(msg_id, data, i)
        if not result:
            continue

        for face in result['faces']:
            if face['det_conf'] is not None:
                entry = (
                    f"{face['timestamp']:<25} | "
                    f"{face['track_id']:<20} | "
                    f"{face['frame_seq']:<10} | "
                    f"{face['det_conf']:.6f}"
                )
                all_entries.append(entry)
                total_faces += 1

                print(
                    f"  [{i}] track_id={face['track_id']} | "
                    f"frame_seq={face['frame_seq']} | "
                    f"SCRFD_det_conf={face['det_conf']:.4f}"
                )

    # Ghi log
    if all_entries:
        write_confidence_log(LOG_FILE, all_entries, mode='write')
        print(f"\n[✓] Đã ghi {total_faces} faces ra: {LOG_FILE}")
    else:
        print("[!] Không có face nào được tìm thấy")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python debug_face_image.py listen     - Listen realtime stream")
        print("  python debug_face_image.py replay     - Đọc history từ stream")
        print("  python debug_face_image.py replay 1000 - Đọc 1000 messages cuối")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == 'listen':
        listen_stream()
    elif cmd == 'replay':
        count = int(sys.argv[2]) if len(sys.argv) > 2 else None
        replay_history(count)
    else:
        print(f"[!] Unknown command: {cmd}")
        sys.exit(1)
