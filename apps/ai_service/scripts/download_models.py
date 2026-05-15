from __future__ import annotations

from pathlib import Path
from urllib.request import urlretrieve


ANTI_SPOOF_URL = (
    "https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx/"
    "resolve/main/minifasnet_v2.onnx"
)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    anti_spoof_path = root / "models" / "anti_spoof" / "minifasnet.onnx"
    insightface_dir = root / "models" / "insightface"

    anti_spoof_path.parent.mkdir(parents=True, exist_ok=True)
    insightface_dir.mkdir(parents=True, exist_ok=True)

    if anti_spoof_path.exists() and anti_spoof_path.stat().st_size > 0:
        print(f"Anti-spoof model already exists: {anti_spoof_path}")
    else:
        print(f"Downloading anti-spoof model to {anti_spoof_path}")
        urlretrieve(ANTI_SPOOF_URL, anti_spoof_path)

    print(f"InsightFace model directory ready: {insightface_dir}")
    print(
        "Place recognition models under models/insightface/models/<model_name>/ "
        "(for example antelopev2/glintr100.onnx)."
    )


if __name__ == "__main__":
    main()
