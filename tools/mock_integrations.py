from fastapi import FastAPI, Request
import uvicorn

app = FastAPI(title="Face Attend Mock Integrations")

@app.post("/api/v1/inference/recognize")
async def mock_recognize(request: Request):
    payload = await request.json()
    print(f"\n[AI MOCK] Received Recognition Request:")
    print(f"  - Message ID: {payload.get('message_id')}")
    print(f"  - Frame Seq: {payload.get('payload', {}).get('frame_sequence')}")
    print(f"  - Object Key: {payload.get('payload', {}).get('frame_ref', {}).get('object_key')}")
    
    # Giả lập trả về kết quả nhận diện thành công
    return {
        "event_name": "recognition_event.detected",
        "payload": {
            "is_unknown": False,
            "is_spoof": False,
            "person_id": "834c0326-724e-4f51-a96d-c2057774780e", # Mock UUID
            "match_score": 0.98
        }
    }

@app.post("/api/v1/internal/events/recognition")
async def mock_backend_ingest(request: Request):
    payload = await request.json()
    print(f"\n[BACKEND MOCK] Received Ingestion Event:")
    print(f"  - Event Type: {payload.get('event_name')}")
    print(f"  - Person ID: {payload.get('payload', {}).get('person_id')}")
    return {"status": "ok"}

@app.post("/api/v1/pipeline/register")
async def mock_reg_test():
    # Helper to test registration flow
    # In a real test, you'd call the Pipeline endpoint
    pass

if __name__ == "__main__":
    print("Mock Services Starting at http://localhost:8001")
    uvicorn.run(app, host="0.0.0.0", port=8001)
