FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install --no-cache-dir fastapi "uvicorn[standard]" numpy
COPY . .
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
