FROM python:3.12-slim

WORKDIR /app

# Build context is the repo root (not services/dispatch) so this image can also
# copy in the shared root-level `security/` package that main.py imports.
COPY services/dispatch/requirements.txt services/dispatch/requirements.txt
RUN pip install --no-cache-dir -r services/dispatch/requirements.txt

COPY security/ security/
COPY services/dispatch/ services/dispatch/

# Mirrors the on-disk repo layout so main.py's
# sys.path.insert(0, "../..") still resolves to /app, where security/ lives.
WORKDIR /app/services/dispatch

EXPOSE 8004

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
