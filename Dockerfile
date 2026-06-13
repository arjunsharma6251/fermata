# Backend image for Hugging Face Spaces (Docker SDK). HF free Spaces give
# 16 GB RAM / 2 vCPU — enough headroom for librosa, which the 512 MB Render
# free tier OOM-killed. Builds from the repo root.
FROM python:3.12-slim

# libsndfile for soundfile mp3 decoding; ffmpeg as a decode fallback
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# HF Spaces routes to $PORT (7860 by default)
ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
