FROM python:3.12-slim

WORKDIR /app

# Build context is the repo root (not services/sentiment) so this image can also
# copy in the shared root-level `security/` package that main.py imports.
COPY services/sentiment/requirements.txt services/sentiment/requirements.txt
RUN pip install --no-cache-dir -r services/sentiment/requirements.txt

COPY security/ security/
COPY services/sentiment/ services/sentiment/

# Mirrors the on-disk repo layout so main.py's
# sys.path.insert(0, "../..") still resolves to /app, where security/ lives.
WORKDIR /app/services/sentiment

EXPOSE 8006

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006"]
