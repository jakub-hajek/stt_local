.PHONY: install install-fe install-be \
       dev dev-fe dev-be \
       test test-fe test-be \
       coverage coverage-fe coverage-be \
       check build clean

# ── Install ──────────────────────────────────────────────
install: install-fe install-be

install-fe:
	cd frontend && bun install

install-be:
	./backend/scripts/install_backend.sh

# ── Dev servers ──────────────────────────────────────────
dev:
	./start.sh

dev-fe:
	cd frontend && bun run dev

dev-be:
	cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8765 --log-level info

# ── Tests ────────────────────────────────────────────────
test: test-fe test-be

test-fe:
	cd frontend && bun run test

test-be:
	cd backend && .venv/bin/pytest

# ── Coverage ─────────────────────────────────────────────
coverage: coverage-fe coverage-be

coverage-fe:
	cd frontend && bun run test:coverage

coverage-be:
	cd backend && .venv/bin/pytest --cov=app --cov-report=term-missing

# ── Checks & builds ─────────────────────────────────────
check:
	cd frontend && bun run check

build:
	cd frontend && bun run build

# ── Cleanup ──────────────────────────────────────────────
clean:
	rm -rf frontend/node_modules frontend/.svelte-kit frontend/coverage frontend/build
	rm -rf backend/__pycache__ backend/.pytest_cache
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
