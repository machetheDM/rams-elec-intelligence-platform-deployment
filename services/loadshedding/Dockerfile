FROM python:3.12-slim

WORKDIR /app

# Build context is the repo root (not services/loadshedding) so this image can
# also copy in the shared root-level `security/` package that main.py imports.
COPY services/loadshedding/requirements.txt services/loadshedding/requirements.txt
RUN pip install --no-cache-dir -r services/loadshedding/requirements.txt

COPY security/ security/
COPY services/loadshedding/ services/loadshedding/

# Mirrors the on-disk repo layout so main.py's
# sys.path.insert(0, "../..") still resolves to /app, where security/ lives.
WORKDIR /app/services/loadshedding

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
