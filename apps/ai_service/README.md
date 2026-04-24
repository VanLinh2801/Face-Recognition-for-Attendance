# AI Service

## Structure

- `app/core/`: config and shared schemas
- `app/io/`: Redis and image loading adapters
- `app/store/`: Qdrant access
- `app/vision/`: detector, recognizer, spoof hooks
- `app/benchmark/`: standalone benchmark for model comparison
- `data/benchmarks/recognizer_compare/`: gallery, probe, and report folders

## Run service

```bash
python -m app.main
```

## Run recognizer benchmark

```bash
python -m app.benchmark.cli
```

The benchmark compares the models listed in `BENCHMARK_RECOGNIZER_MODELS`.
It reports closed-set rank-1 accuracy, open-set threshold metrics, and average
embedding latency for gallery/probe images.
