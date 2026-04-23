.PHONY: dev backend frontend install

# Start both servers with color-coded output
dev:
	npm run dev

# Start only the Python backend (kills any stale process on :8000 first)
backend:
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	cd backend && . venv/bin/activate && uvicorn main:app --port 8000 --reload --reload-dir .

# Start only the Next.js frontend
frontend:
	cd frontend && npm run dev

# First-time setup: create venv, install all dependencies
install:
	@echo "→ Setting up Python virtual environment..."
	cd backend && python3 -m venv venv && . venv/bin/activate && pip install -r requirements.txt
	@echo "→ Installing root npm dependencies (concurrently)..."
	npm install
	@echo "→ Installing frontend npm dependencies..."
	cd frontend && npm install
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start both servers."
