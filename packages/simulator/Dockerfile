FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY packages/common /app/packages/common
COPY packages/simulator /app/packages/simulator

RUN pip install /app/packages/common /app/packages/simulator

CMD ["imm-sim", "--machine-id", "imm-01"]
