# Tune-In Backend

FastAPI read-only REST API powering **Tune-In**. Computes `Hype Velocity`, `Hype Index`, stepped `LOCF` time-series curves, variant `Share of Demand`, and catalog rollups from the shared PostgreSQL + `pgvector` database.

See the [root README](../README.md) for system architecture, mathematical formulas, and endpoint documentation.

---

## Prerequisites

- **Python** `>= 3.10` and [`uv`](https://docs.astral.sh/uv/)
- **PostgreSQL + `pgvector`** populated by the sibling scraper repo [Lolgend/vinyl-reddit-scrape](https://github.com/Lolgend/vinyl-reddit-scrape)
- Local path dependency resolved via `pyproject.toml`:
  ```toml
  [tool.uv.sources]
  reddit-scrape = { path = "../../vinyl-reddit-scrape" }
  ```
  Ensure `vinyl-reddit-scrape` is checked out at that relative path (or adjust `[tool.uv.sources]` if your local folder layout differs).

---

## Configuration

Copy `.env.example` to `.env` inside `backend/`:

```powershell
Copy-Item .env.example .env
```

Environment variables (from [`.env.example`](./.env.example)):

- `DATABASE_URL` — PostgreSQL connection string (normalized automatically to `postgresql+psycopg://` by [`src/backend/db.py`](./src/backend/db.py)).
- `PYTHONUTF8="1"` — Recommended on Windows to handle Unicode dashes and international artist names cleanly.

> **Note:** [`db.py`](./src/backend/db.py) looks for `.env` in the working directory, `backend/.env`, and `../../reddit-scrape/.env`. Placing `.env` directly in `backend/` avoids path ambiguity. The SQLAlchemy engine always connects with `postgresql_readonly=True` and `-c default_transaction_read_only=on`.

---

## Setup & Running Locally

From the `backend/` directory:

```powershell
# Install dependencies into the uv virtual environment
uv sync

# Start the FastAPI server with reload on http://127.0.0.1:8000
uv run backend
```

Interactive OpenAPI docs are served at `http://127.0.0.1:8000/docs`.

---

## Testing & Quality Checks

From the `backend/` directory:

```powershell
# Run automated test suite
uv run pytest

# Static type checking
uv run mypy src tests

# Lint & formatting check
uv run ruff check .
```
