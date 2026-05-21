#!/bin/bash
# ============================================================
#  docker-entrypoint.sh
#  Auto-detect GPU and switch between CUDA / CPU mode
#
#  For ai_service: detects GPU, sets ONNX_EXECUTION_PROVIDER
#  For pipeline:   detects GPU, installs correct onnxruntime
# ============================================================

set -e

# --- Detect GPU ---
detect_gpu() {
    if command -v nvidia-smi &>/dev/null && nvidia-smi &>/dev/null; then
        return 0  # GPU found
    fi
    return 1  # No GPU
}

# --- Install CPU packages for pipeline ---
install_cpu_packages() {
    echo "[entrypoint] No GPU detected. Switching to CPU mode..."

    if [ -f "/app/requirements-gpu.txt" ] && [ ! -f "/app/requirements-cpu.txt" ]; then
        # Build args don't bake both files in — user must have built with GPU
        # Re-install CPU packages on top
        echo "[entrypoint] Installing CPU packages on top of GPU image..."
        pip uninstall -y onnxruntime onnxruntime-gpu onnxruntime-openvino 2>/dev/null || true
        pip install --no-cache-dir onnxruntime
    elif [ -f "/app/requirements-cpu.txt" ]; then
        echo "[entrypoint] CPU requirements file found, skipping install."
    fi
}

# --- Set ONNX provider for ai_service ---
set_ai_provider() {
    if detect_gpu; then
        echo "[entrypoint] GPU detected. Using CUDAExecutionProvider."
        export ONNX_EXECUTION_PROVIDER="${ONNX_EXECUTION_PROVIDER:-CUDAExecutionProvider}"
    else
        echo "[entrypoint] No GPU detected. Using CPUExecutionProvider."
        export ONNX_EXECUTION_PROVIDER="CPUExecutionProvider"
    fi
}

# --- Set pipeline provider ---
set_pipeline_provider() {
    if detect_gpu; then
        echo "[entrypoint] GPU detected. Using CUDAExecutionProvider."
        export ONNX_EXECUTION_PROVIDER="${ONNX_EXECUTION_PROVIDER:-CUDAExecutionProvider}"
    else
        echo "[entrypoint] No GPU detected. Using CPUExecutionProvider."
        export ONNX_EXECUTION_PROVIDER="CPUExecutionProvider"
    fi
}

# --- Main logic based on SERVICE_NAME ---
SERVICE_NAME="${SERVICE_NAME:-}"

echo "[entrypoint] Starting face_attend service: ${SERVICE_NAME:-unknown}"

case "$SERVICE_NAME" in
    ai-service)
        set_ai_provider
        if ! detect_gpu; then
            install_cpu_packages
        fi
        ;;
    pipeline)
        set_pipeline_provider
        if ! detect_gpu; then
            install_cpu_packages
        fi
        ;;
    *)
        # Fallback: just detect and set
        if detect_gpu; then
            echo "[entrypoint] GPU detected."
            export ONNX_EXECUTION_PROVIDER="${ONNX_EXECUTION_PROVIDER:-CUDAExecutionProvider}"
        else
            echo "[entrypoint] No GPU detected, using CPU."
            export ONNX_EXECUTION_PROVIDER="CPUExecutionProvider"
            install_cpu_packages
        fi
        ;;
esac

echo "[entrypoint] ONNX_EXECUTION_PROVIDER=$ONNX_EXECUTION_PROVIDER"
echo "[entrypoint] Running: $@"

exec "$@"
