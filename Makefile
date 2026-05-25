.PHONY: demo train test web lint fmt clean

VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

$(VENV)/bin/activate:
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip

venv: $(VENV)/bin/activate

demo: venv
	$(PYTHON) run.py

train: venv
	$(PYTHON) scripts/generate_training_data.py
	$(PYTHON) scripts/retrain_models.py

test: venv
	$(VENV)/bin/pytest tests/ -v

web:
	cd web && npm install && npm run build

lint: venv
	$(VENV)/bin/ruff check src/ scripts/ run.py tests/

fmt: venv
	$(VENV)/bin/ruff format src/ scripts/ run.py tests/

clean:
	rm -rf data/synthetic artifacts/models web/dist __pycache__ .pytest_cache

