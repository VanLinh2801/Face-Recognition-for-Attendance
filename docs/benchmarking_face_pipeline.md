# Face System Benchmarking

This benchmark folder measures the runtime cost of the actual attendance system.
Recognizer model comparison lives in the separate `Recognizer-Benchmark/`
workspace.

## What to Measure

1. Pipeline preparation
   - SCRFD detector latency
   - face cropper latency
   - faces emitted per frame

2. AI service with the selected recognizer
   - alignment + embedding latency inside service logs/metrics
   - Qdrant search latency
   - Redis/MinIO overhead

3. Vector search
   - Qdrant search latency after the embedding is available

4. End-to-end service
   - `recognition.requested` publish time to `recognition_event.detected` or `unknown_event.detected`
   - Redis, MinIO, Qdrant, and AI service overhead together

Use the same image/video set for every run. Do not use this folder to compare
`antelopev2`, `buffalo_l`, `buffalo_m`, and `buffalo_s`; compare them in
`Recognizer-Benchmark/benchmark.ipynb`, then bring the selected model back here
for system measurement.

## Folder Layout

Benchmark scripts live outside app code:

```text
benchmarks/
  face_pipeline/
    prepare_faces.py
  ai_service/
    benchmark_ai_stages.py
  system/
    monitor_resources.py
```

Use this split:

- `face_pipeline/`: measure detector and crop preparation cost.
- `ai_service/`: measure selected AI service model stages with prepared crops.
- `system/`: measure full service resource usage while Docker/services are running.

Keep `face_pipeline` and `ai_service` separate. Detector/cropper and AI
embedding have different bottlenecks, dependencies, and owners. Separating them
lets you see whether time is spent before the Redis handoff or inside AI
processing. End-to-end system monitoring then shows the combined cost.

## Benchmark Env

Benchmark scripts load `benchmarks/.env.benchmark` by default when the file
exists. Copy the example once and adjust local paths:

```powershell
Copy-Item benchmarks\.env.benchmark.example benchmarks\.env.benchmark
```

Use `--env-file` to point a script at a different config file:

```powershell
python benchmarks\ai_service\benchmark_ai_stages.py --env-file benchmarks\.env.benchmark
```

CLI arguments always override values from the env file. The most important
settings are:

- `BENCH_INPUT_DIR`, `BENCH_OUTPUT_DIR`, `BENCH_MANIFEST`
- `SCRFD_MODEL_PATH`
- `INSIGHTFACE_MODEL_DIR`, `INSIGHTFACE_MODEL_NAME`,
  `INSIGHTFACE_RECOGNITION_MODEL_FILE`, `INSIGHTFACE_CTX_ID`
- `BENCH_INCLUDE_QDRANT`, `QDRANT_URL`, `QDRANT_COLLECTION`
- `BENCH_AI_SUMMARY_OUTPUT`, `BENCH_AI_SAMPLES_OUTPUT`
- `BENCH_RESOURCE_OUTPUT`

## Pipeline Component Benchmark

Use this when you want to know how expensive SCRFD detection and face crop
preparation are, independent of Redis/MinIO/Qdrant:

```powershell
python benchmarks\face_pipeline\prepare_faces.py
```

You can still override any value from the command line:

```powershell
python benchmarks\face_pipeline\prepare_faces.py `
  --input-dir bench_data\frames `
  --output-dir bench_data\prepared_faces `
  --manifest bench_data\prepared_faces.jsonl `
  --scrfd-model-path apps\pipeline\app\models\scrfd_2.5g_bnkps.onnx
```

Output:

- cropped face JPEGs
- `prepared_faces.jsonl`, each row containing `image_path`, shifted `kpss`, `bbox`, and detection confidence
- detector/cropper latency summary

## AI Service Stage Benchmark

Use this after selecting a recognizer model in `Recognizer-Benchmark`. It uses
the same `InsightFaceEmbedder` and optional `QdrantVectorStore` as the service,
so model config stays close to production.

```powershell
python benchmarks\ai_service\benchmark_ai_stages.py
```

Example with explicit overrides:

```powershell
python benchmarks\ai_service\benchmark_ai_stages.py `
  --manifest bench_data\prepared_faces.jsonl `
  --model-dir apps\ai_service\models\insightface `
  --model-name buffalo_l `
  --model-file w600k_r50.onnx `
  --ctx-id 0 `
  --repeat 5 `
  --include-qdrant `
  --output bench_results\ai_service\buffalo_l_ai_stages.json `
  --samples-output bench_results\ai_service\buffalo_l_ai_samples.jsonl
```

If you omit model arguments, the script uses the current `ai_service` config and
`.env`.

Outputs:

- `decode_ms`: image bytes read from prepared crop files
- `embedding_ms`: AI service embedder time, including PIL decode, `norm_crop`, recognizer `get_feat`, and normalization
- `qdrant_search_ms`: optional Qdrant search cost
- `total_ai_ms`: embedding plus optional Qdrant search per face
- `throughput_fps`: faces per second for selected AI stages

Model switching is controlled by the same settings as `ai_service`:

- `INSIGHTFACE_MODEL_NAME`
- `INSIGHTFACE_MODEL_DIR`
- `INSIGHTFACE_RECOGNITION_MODEL_FILE`
- `INSIGHTFACE_CTX_ID`

The benchmark exposes these as `--model-name`, `--model-dir`, `--model-file`,
and `--ctx-id`.

## System Resource Monitoring

Run this while the full stack is processing a video/camera stream:

```powershell
python benchmarks\system\monitor_resources.py
```

Example with explicit overrides:

```powershell
python benchmarks\system\monitor_resources.py `
  --duration-sec 300 `
  --interval-sec 1 `
  --output bench_results\system\resources.jsonl
```

The monitor records:

- Docker container CPU and memory from `docker stats`
- GPU utilization, memory, power, and temperature from `nvidia-smi`
- optional process RSS if `psutil` is installed and `--process-name` is provided

Example with native Python services:

```powershell
python benchmarks\system\monitor_resources.py `
  --duration-sec 300 `
  --interval-sec 1 `
  --process-name python.exe `
  --output bench_results\system\native_resources.jsonl
```

## End-to-End Benchmark

After choosing a recognizer in `Recognizer-Benchmark`, configure `ai_service`
with that model, run the full services, and measure:

- input frame timestamp
- `recognition.requested` publish timestamp
- AI event output timestamp
- final backend event timestamp if backend is included

End-to-end includes Redis, MinIO, Qdrant, camera decode, and batching behavior,
so it is useful for system sizing, not for first-pass recognizer comparison.

For end-to-end, report at least:

- input FPS and resolution
- total frames processed
- faces detected
- faces sent to AI
- known/unknown events emitted
- AI event latency p50/p95
- Docker memory peak per service
- GPU memory peak and GPU utilization

## Recommended System Result Table

| Model | GPU | Video/FPS | Pipeline p95 ms | AI p95 ms | End-to-end p95 ms | GPU memory MB | Pipeline RAM MB | AI RAM MB | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| selected model | RTX 4070 | | | | | | | | |

For recognizer accuracy/model ranking, use:

```text
Recognizer-Benchmark/benchmark.ipynb
```
