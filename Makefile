.PHONY: dev dev-up dev-down dev-build dev-logs dev-restart dev-clean \
        prod prod-up prod-down prod-build prod-logs \
        backend-logs frontend-logs mongo-logs rabbit-logs \
        backend-shell frontend-shell mongo-shell \
        install-deps rebuild-backend rebuild-frontend

# ===========================================
# Development Commands
# ===========================================

# Start development environment
dev: dev-up

dev-up:
	docker compose -f docker-compose.dev.yml up -d
	@echo ""
	@echo "🚀 Development environment started!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:4000"
	@echo "   RabbitMQ: http://localhost:15672 (bugbounty/bugbounty2024)"
	@echo ""
	@echo "📝 Run 'make dev-logs' to see logs"

dev-down:
	docker compose -f docker-compose.dev.yml down

dev-build:
	docker compose -f docker-compose.dev.yml build --no-cache

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

dev-restart:
	docker compose -f docker-compose.dev.yml restart

dev-clean:
	docker compose -f docker-compose.dev.yml down -v --rmi local
	@echo "✅ Cleaned up development environment (volumes and images removed)"

# ===========================================
# Production Commands
# ===========================================

prod: prod-up

prod-up:
	docker compose up -d
	@echo ""
	@echo "🚀 Production environment started!"
	@echo "   Frontend: http://localhost:3000"
	@echo "   Backend:  http://localhost:4000"
	@echo ""

prod-down:
	docker compose down

prod-build:
	docker compose build --no-cache

prod-logs:
	docker compose logs -f

# ===========================================
# Individual Service Logs
# ===========================================

backend-logs:
	docker compose -f docker-compose.dev.yml logs -f backend

frontend-logs:
	docker compose -f docker-compose.dev.yml logs -f frontend

mongo-logs:
	docker compose -f docker-compose.dev.yml logs -f mongodb

rabbit-logs:
	docker compose -f docker-compose.dev.yml logs -f rabbitmq

# ===========================================
# Shell Access
# ===========================================

backend-shell:
	docker compose -f docker-compose.dev.yml exec backend sh

frontend-shell:
	docker compose -f docker-compose.dev.yml exec frontend sh

mongo-shell:
	docker compose -f docker-compose.dev.yml exec mongodb mongosh -u admin -p bugbounty2024 --authenticationDatabase admin

# ===========================================
# Utility Commands
# ===========================================

# Rebuild a specific service
rebuild-backend:
	docker compose -f docker-compose.dev.yml build --no-cache backend
	docker compose -f docker-compose.dev.yml up -d backend

rebuild-frontend:
	docker compose -f docker-compose.dev.yml build --no-cache frontend
	docker compose -f docker-compose.dev.yml up -d frontend

# Install deps in containers (useful after package.json changes)
install-deps:
	docker compose -f docker-compose.dev.yml exec backend npm install
	docker compose -f docker-compose.dev.yml exec frontend npm install
	@echo "✅ Dependencies installed in both containers"

# Show status
status:
	docker compose -f docker-compose.dev.yml ps

# Full reset - removes everything and rebuilds
reset: dev-clean dev-build dev-up

# Update MongoDB validator for programs collection
update-mongo-validator:
	@echo "Updating MongoDB validator..."
	docker compose -f docker-compose.dev.yml exec -T mongodb mongosh -u admin -p bugbounty2024 --authenticationDatabase admin bugbounty < docker/update-validator.js || \
	docker compose exec -T mongodb mongosh -u admin -p bugbounty2024 --authenticationDatabase admin bugbounty < docker/update-validator.js
	@echo "✅ MongoDB validator updated successfully!"

# ===========================================
# Worker Commands (Parallel Processing)
# ===========================================

# Start workers (default 3 replicas)
workers-up:
	docker compose -f docker-compose.dev.yml up -d subfinder-worker
	@echo ""
	@echo "🚀 Subfinder workers started!"
	@echo "   Monitor: http://localhost:15672 (RabbitMQ)"
	@echo ""

# Scale workers (usage: make workers-scale N=5)
workers-scale:
	docker compose -f docker-compose.dev.yml up -d --scale subfinder-worker=$(N)
	@echo "✅ Scaled to $(N) subfinder workers"

# Stop workers
workers-down:
	docker compose -f docker-compose.dev.yml stop subfinder-worker
	docker compose -f docker-compose.dev.yml rm -f subfinder-worker

# View worker logs
workers-logs:
	docker compose -f docker-compose.dev.yml logs -f subfinder-worker

# Rebuild workers
workers-rebuild:
	docker compose -f docker-compose.dev.yml build --no-cache subfinder-worker
	docker compose -f docker-compose.dev.yml up -d subfinder-worker

# ===========================================
# CLI Commands
# ===========================================

cli-install:
	cd cli && npm install
	@echo "✅ CLI installed! Run 'make bb' or './cli/bb' to use"

# Run CLI commands
bb:
	@./cli/bb $(filter-out $@,$(MAKECMDGOALS))

# CLI shortcuts
subfinder:
	@./cli/bb subfinder $(filter-out $@,$(MAKECMDGOALS))

recon:
	@./cli/bb recon $(filter-out $@,$(MAKECMDGOALS))

ns-all:
	@./cli/bb ns-all

http-all:
	@./cli/bb http-all

# Prevent make from treating arguments as targets
%:
	@:


