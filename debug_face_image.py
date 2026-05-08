import redis
import base64
import json
import os

# Cấu hình Redis
REDIS_HOST = 'localhost'
REDIS_PORT = 6379
STREAM_NAME = 'pipeline_ai'
OUTPUT_DIR = 'debug_images'

if not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)

def save_debug_images():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    
    print(f"[*] Đang lắng nghe stream: {STREAM_NAME}...")
    try:
        # Lấy 20 message mới nhất (đảo ngược để lấy mới nhất)
        messages = r.xrevrange(STREAM_NAME, max='+', min='-', count=20)
        if not messages:
            print("[!] Không tìm thấy message nào trong stream.")
            return

        print(f"[+] Tìm thấy {len(messages)} message (lấy mới nhất trước)")

        saved = 0
        for i, (msg_id, data) in enumerate(messages):
            # Key là 'envelope' không phải 'payload'
            envelope_str = data.get('envelope')
            if not envelope_str:
                continue

            envelope = json.loads(envelope_str)
            inner = envelope.get('payload', {})
            stream_id = inner.get('stream_id', '')
            faces = inner.get('faces', [])

            print(f"  Message {i}: stream_id={stream_id}, faces={len(faces)}")

            for j, face in enumerate(faces):
                track_id = face.get('track_id', 'unknown')

                # Lưu ảnh Crop
                img_b64 = face.get('cropped_face_b64')
                if img_b64:
                    img_data = base64.b64decode(img_b64)
                    filename = os.path.join(OUTPUT_DIR, f"face_{track_id}_{i}.jpg")
                    with open(filename, 'wb') as f:
                        f.write(img_data)
                    print(f"    [+] Saved Crop: {filename} ({len(img_data)} bytes)")
                    saved += 1

                # Lưu ảnh Gốc (nếu có)
                full_b64 = face.get('full_frame_b64')
                if full_b64:
                    full_data = base64.b64decode(full_b64)
                    full_filename = os.path.join(OUTPUT_DIR, f"full_{track_id}_{i}.jpg")
                    with open(full_filename, 'wb') as f:
                        f.write(full_data)
                    print(f"    [✓] Saved FULL: {full_filename} ({len(full_data)} bytes)")
                    saved += 1

        print(f"\n[✓] Đã lưu {saved} ảnh vào: {os.path.abspath(OUTPUT_DIR)}")

    except Exception as e:
        import traceback
        print(f"[!] Lỗi: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    save_debug_images()
