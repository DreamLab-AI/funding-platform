#!/usr/bin/env bash
# =============================================================================
# Local Development Setup Script
# Funding Application Platform
# =============================================================================
# Usage: ./scripts/setup.sh [options]
# Options:
#   --full      Start all services including MinIO, MailHog, ClamAV
#   --minimal   Start only PostgreSQL and Redis
#   --reset     Reset all data and start fresh
#   --help      Show this help message
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

# Default options
PROFILE="dev"
RESET=false

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Funding Platform - Local Development Setup

Usage: ./scripts/setup.sh [options]

Options:
  --full      Start all services (PostgreSQL, Redis, MinIO, MailHog, ClamAV)
  --minimal   Start only PostgreSQL and Redis
  --reset     Reset all data and start fresh (WARNING: destroys all data)
  --help      Show this help message

Examples:
  ./scripts/setup.sh                 # Start with default 'dev' profile
  ./scripts/setup.sh --full          # Start all services
  ./scripts/setup.sh --minimal       # Start minimal services
  ./scripts/setup.sh --reset --full  # Reset and start all services

EOF
}

check_dependencies() {
    log_info "Checking dependencies..."

    local missing_deps=()

    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi

    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing_deps+=("docker-compose")
    fi

    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi

    # Check pnpm (optional but recommended)
    if ! command -v pnpm &> /dev/null; then
        log_warning "pnpm not found. Install with: npm install -g pnpm"
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install the missing dependencies and try again."
        exit 1
    fi

    log_success "All dependencies found"
}

setup_env_file() {
    log_info "Setting up environment file..."

    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_success "Created .env from .env.example"

            # Generate secrets for local development
            log_info "Generating local development secrets..."

            # Generate JWT secret
            JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
            sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "$ENV_FILE"

            # Generate session secret
            SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
            sed -i.bak "s|SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|" "$ENV_FILE"

            # Clean up backup file
            rm -f "${ENV_FILE}.bak"

            log_success "Generated local development secrets"
        else
            log_error ".env.example not found!"
            exit 1
        fi
    else
        log_info ".env file already exists, skipping..."
    fi
}

setup_backend_env() {
    log_info "Setting up backend environment..."

    local backend_env="${PROJECT_ROOT}/backend/.env"
    local backend_env_example="${PROJECT_ROOT}/backend/.env.example"

    if [ ! -f "$backend_env" ] && [ -f "$backend_env_example" ]; then
        cp "$backend_env_example" "$backend_env"
        log_success "Created backend/.env from backend/.env.example"
    fi
}

setup_frontend_env() {
    log_info "Setting up frontend environment..."

    local frontend_env="${PROJECT_ROOT}/frontend/.env.local"
    local frontend_env_example="${PROJECT_ROOT}/frontend/.env.example"

    if [ ! -f "$frontend_env" ] && [ -f "$frontend_env_example" ]; then
        cp "$frontend_env_example" "$frontend_env"
        log_success "Created frontend/.env.local from frontend/.env.example"
    fi
}

reset_data() {
    log_warning "This will destroy all local data. Are you sure? (y/N)"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Stopping containers..."
    docker-compose -f "${PROJECT_ROOT}/docker-compose.yml" down -v 2>/dev/null || true

    log_info "Removing Docker volumes..."
    docker volume rm funding_platform_postgres_data 2>/dev/null || true
    docker volume rm funding_platform_redis_data 2>/dev/null || true
    docker volume rm funding_platform_clamav_data 2>/dev/null || true
    docker volume rm funding_platform_minio_data 2>/dev/null || true
    docker volume rm funding_platform_uploads_data 2>/dev/null || true

    log_info "Removing local uploads..."
    rm -rf "${PROJECT_ROOT}/uploads"/*

    log_success "All data has been reset"
}

start_services() {
    log_info "Starting services with profile: ${PROFILE}..."

    cd "$PROJECT_ROOT"

    # Determine compose command
    local compose_cmd
    if docker compose version &> /dev/null; then
        compose_cmd="docker compose"
    else
        compose_cmd="docker-compose"
    fi

    # Build and start containers
    if [ "$PROFILE" == "full" ]; then
        $compose_cmd --profile full up -d --build
    elif [ "$PROFILE" == "minimal" ]; then
        $compose_cmd up -d postgres redis
    else
        $compose_cmd --profile dev up -d --build
    fi

    log_success "Services started"
}

wait_for_services() {
    log_info "Waiting for services to be healthy..."

    local max_attempts=30
    local attempt=1

    # Wait for PostgreSQL
    while [ $attempt -le $max_attempts ]; do
        if docker exec funding_platform_db pg_isready -U postgres &>/dev/null; then
            log_success "PostgreSQL is ready"
            break
        fi
        log_info "Waiting for PostgreSQL... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "PostgreSQL failed to start"
        exit 1
    fi

    # Wait for Redis
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker exec funding_platform_redis redis-cli ping &>/dev/null; then
            log_success "Redis is ready"
            break
        fi
        log_info "Waiting for Redis... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Redis failed to start"
        exit 1
    fi
}

install_dependencies() {
    log_info "Installing Node.js dependencies..."

    cd "$PROJECT_ROOT"

    # Install backend dependencies
    if [ -f "backend/package.json" ]; then
        log_info "Installing backend dependencies..."
        cd backend
        if command -v pnpm &> /dev/null; then
            pnpm install
        else
            npm install
        fi
        cd ..
    fi

    # Install frontend dependencies
    if [ -f "frontend/package.json" ]; then
        log_info "Installing frontend dependencies..."
        cd frontend
        if command -v pnpm &> /dev/null; then
            pnpm install
        else
            npm install
        fi
        cd ..
    fi

    log_success "Dependencies installed"
}

run_migrations() {
    log_info "Running database migrations..."

    cd "${PROJECT_ROOT}/backend"

    if command -v pnpm &> /dev/null; then
        pnpm db:migrate 2>/dev/null || log_warning "Migration command not found or failed. Run manually if needed."
    else
        npm run db:migrate 2>/dev/null || log_warning "Migration command not found or failed. Run manually if needed."
    fi
}

print_summary() {
    echo ""
    echo "=============================================="
    log_success "Setup complete!"
    echo "=============================================="
    echo ""
    echo "Services:"
    echo "  - PostgreSQL: localhost:5432"
    echo "  - Redis:      localhost:6379"

    if [ "$PROFILE" == "full" ] || [ "$PROFILE" == "dev" ]; then
        echo "  - MailHog:    localhost:8025 (Web UI)"
        echo "  - MinIO:      localhost:9001 (Console)"
    fi

    echo ""
    echo "To start development:"
    echo "  Backend:  cd backend && pnpm dev"
    echo "  Frontend: cd frontend && pnpm dev"
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "To stop services:"
    echo "  docker-compose down"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                PROFILE="full"
                shift
                ;;
            --minimal)
                PROFILE="minimal"
                shift
                ;;
            --reset)
                RESET=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    echo "=============================================="
    echo "Funding Platform - Local Development Setup"
    echo "=============================================="
    echo ""

    check_dependencies

    if [ "$RESET" = true ]; then
        reset_data
    fi

    setup_env_file
    setup_backend_env
    setup_frontend_env
    start_services
    wait_for_services
    install_dependencies
    run_migrations
    print_summary
}

main "$@"
