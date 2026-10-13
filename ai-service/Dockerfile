# =============================================================================
# Event Management System - AI Service Dockerfile
# =============================================================================
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    AI_SERVICE_HOST=0.0.0.0 \
    AI_SERVICE_PORT=8000

WORKDIR /app

# Create a non-privileged user to run the service securely
RUN addgroup --system appgroup && adduser --system --group appuser

# Install dependencies first for Docker layer caching
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY main.py ./
COPY models/ ./models/
COPY routes/ ./routes/
COPY services/ ./services/

# Set ownership to non-root user
RUN chown -R appuser:appgroup /app

# Run as non-root user
USER appuser

# Expose AI service port
EXPOSE 8000

# Health check probe against /health readiness endpoint
HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
