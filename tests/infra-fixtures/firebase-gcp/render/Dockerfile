# Service de rendu (Cloud Run).
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg sox \
      texlive-latex-base \
    && apt-get clean

RUN pip install --no-cache-dir "manim-voiceover[azure]" numpy

ENV RENDER_DIR=/app \
    RENDER_VOICE=azure \
    PORT=8080

EXPOSE 8080
CMD ["python", "-m", "render"]
