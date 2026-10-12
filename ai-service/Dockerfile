# =============================================================================
# EventFlow AI Service Dockerfile (Python 3.11 Slim)
# =============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /usr/src/app

# Install dependencies first for efficient layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and tests
COPY main.py .
COPY models/ ./models/
COPY routes/ ./routes/
COPY services/ ./services/
COPY tests/ ./tests/

# Create a non-root user and set permissions
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /usr/src/app

USER appuser

# Expose internal AI service port
EXPOSE 8000

# Health check using Python's standard library urllib
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request, sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').getcode() == 200 else 1)"

# Run the FastAPI application using Uvicorn bound to 0.0.0.0
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
