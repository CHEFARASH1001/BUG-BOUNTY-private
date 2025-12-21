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

