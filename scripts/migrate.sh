#!/usr/bin/env bash
# =============================================================================
# Database Migration Script
# Funding Application Platform
# =============================================================================
# Usage: ./scripts/migrate.sh [command] [options]
# Commands:
#   up          Run pending migrations (default)
#   down        Rollback last migration
#   status      Show migration status
#   create      Create a new migration file
#   reset       Reset database (WARNING: destroys all data)
#   seed        Run database seeders
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    source "${PROJECT_ROOT}/.env"
    set +a
fi

if [ -f "${BACKEND_DIR}/.env" ]; then
    set -a
    source "${BACKEND_DIR}/.env"
    set +a
fi

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
Funding Platform - Database Migration Script

Usage: ./scripts/migrate.sh [command] [options]

Commands:
  up              Run pending migrations (default)
  down            Rollback last migration
  down:all        Rollback all migrations
  status          Show migration status
  create <name>   Create a new migration file
  reset           Reset database and run all migrations
  seed            Run database seeders
  fresh           Drop all tables and re-run migrations (alias for reset)

Options:
  --env <env>     Specify environment (development, staging, production)
  --dry-run       Show what would be done without executing
  --help          Show this help message

Examples:
  ./scripts/migrate.sh                     # Run pending migrations
  ./scripts/migrate.sh status              # Show migration status
  ./scripts/migrate.sh create add_users    # Create migration file
  ./scripts/migrate.sh down                # Rollback last migration
  ./scripts/migrate.sh reset               # Reset and re-run all migrations

EOF
}

check_database_connection() {
    log_info "Checking database connection..."

    if [ -z "${DATABASE_URL:-}" ]; then
        log_error "DATABASE_URL is not set"
        exit 1
    fi

    # Extract host and port from DATABASE_URL
    local db_host
    local db_port
    db_host=$(echo "$DATABASE_URL" | sed -E 's/.*@([^:]+):.*/\1/')
    db_port=$(echo "$DATABASE_URL" | sed -E 's/.*:([0-9]+)\/.*/\1/')

    # Check if database is reachable
    if ! nc -z "$db_host" "$db_port" 2>/dev/null; then
        log_error "Cannot connect to database at ${db_host}:${db_port}"
        log_info "Make sure the database is running: docker-compose up -d postgres"
        exit 1
    fi

    log_success "Database connection OK"
}

run_npm_command() {
    local cmd="$1"
    cd "$BACKEND_DIR"

    if command -v pnpm &> /dev/null; then
        pnpm "$cmd"
    else
        npm run "$cmd"
    fi
}

migrate_up() {
    log_info "Running pending migrations..."
    run_npm_command "db:migrate"
    log_success "Migrations completed"
}

migrate_down() {
    log_info "Rolling back last migration..."
    run_npm_command "db:migrate:undo"
    log_success "Rollback completed"
}

migrate_down_all() {
    log_warning "This will rollback ALL migrations. Are you sure? (y/N)"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Rolling back all migrations..."
    run_npm_command "db:migrate:undo:all"
    log_success "All migrations rolled back"
}

migrate_status() {
    log_info "Migration status:"
    run_npm_command "db:migrate:status"
}

migrate_create() {
    local name="${1:-}"
    if [ -z "$name" ]; then
        log_error "Migration name is required"
        log_info "Usage: ./scripts/migrate.sh create <migration_name>"
        exit 1
    fi

    log_info "Creating migration: ${name}"
    cd "$BACKEND_DIR"

    if command -v pnpm &> /dev/null; then
        pnpm db:migrate:create -- --name "$name"
    else
        npm run db:migrate:create -- --name "$name"
    fi

    log_success "Migration file created"
}

migrate_reset() {
    log_warning "This will DESTROY ALL DATA and re-run migrations. Are you sure? (y/N)"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Resetting database..."

    # Drop and recreate database
    if command -v psql &> /dev/null; then
        # Extract database name from URL
        local db_name
        db_name=$(echo "$DATABASE_URL" | sed -E 's/.*\/([^?]+).*/\1/')
        local db_url_no_db
        db_url_no_db=$(echo "$DATABASE_URL" | sed -E 's/(.*\/)[^?]+/\1postgres/')

        psql "$db_url_no_db" -c "DROP DATABASE IF EXISTS ${db_name};"
        psql "$db_url_no_db" -c "CREATE DATABASE ${db_name};"
        log_success "Database recreated"
    else
        log_warning "psql not found, using migrate:undo:all instead"
        run_npm_command "db:migrate:undo:all" 2>/dev/null || true
    fi

    # Run all migrations
    migrate_up

    log_success "Database reset completed"
}

run_seed() {
    log_info "Running database seeders..."
    run_npm_command "db:seed"
    log_success "Seeding completed"
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    local command="${1:-up}"
    shift || true

    case "$command" in
        up)
            check_database_connection
            migrate_up
            ;;
        down)
            check_database_connection
            migrate_down
            ;;
        down:all)
            check_database_connection
            migrate_down_all
            ;;
        status)
            check_database_connection
            migrate_status
            ;;
        create)
            migrate_create "$@"
            ;;
        reset|fresh)
            check_database_connection
            migrate_reset
            ;;
        seed)
            check_database_connection
            run_seed
            ;;
        --help|-h|help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
