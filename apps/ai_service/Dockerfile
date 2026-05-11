FROM python:3.11-slim

# System deps needed by OpenCV and InsightFace
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libglib2.0-0 \
    libgl1 \
    libgomp1 \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache friendly)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
    && pip install --no-cache-dir Cython numpy==2.1.3
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Model weights directory (mount at runtime or bake in)
RUN mkdir -p /app/models/insightface /app/models/anti_spoof

ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
