FROM python:3.12-slim

WORKDIR /app

# Build context is the repo root (not services/triage) so this image can also
# copy in the shared root-level `security/` package that main.py imports.
COPY services/triage/requirements.txt services/triage/requirements.txt
RUN pip install --no-cache-dir -r services/triage/requirements.txt

COPY security/ security/
COPY services/triage/ services/triage/

# Mirrors the on-disk repo layout so main.py's
# sys.path.insert(0, "../..") still resolves to /app, where security/ lives.
WORKDIR /app/services/triage

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
