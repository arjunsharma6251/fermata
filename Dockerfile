# Backend image for Hugging Face Spaces (Docker SDK). HF free Spaces give
# 16 GB RAM / 2 vCPU — enough headroom for librosa, which the 512 MB Render
# free tier OOM-killed. Builds from the repo root.
FROM python:3.12-slim

# libsndfile for soundfile mp3 decoding; ffmpeg as a decode fallback
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# HF Spaces run the container as UID 1000, not root — create that user and
# give it a real HOME so caches (pip, numba, librosa, our SQLite) are writable
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PORT=7860 \
    FERMATA_CACHE_DIR=/home/user/cache

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
RUN mkdir -p /home/user/cache && chown -R user:user /app /home/user

USER user

EXPOSE 7860

# HF routes external traffic to $PORT (7860); bind all interfaces
CMD ["sh", "-c", "cd backend && uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
