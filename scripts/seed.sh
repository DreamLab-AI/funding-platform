#!/usr/bin/env bash
# =============================================================================
# Database Seeding Script
# Funding Application Platform
# =============================================================================
# Usage: ./scripts/seed.sh [options]
# Options:
#   --all       Seed all data (default)
#   --users     Seed users only
#   --calls     Seed funding calls only
#   --apps      Seed sample applications only
#   --reset     Clear existing data before seeding
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
Funding Platform - Database Seeding Script

Usage: ./scripts/seed.sh [options]

Options:
  --all       Seed all data (default)
  --users     Seed users only
  --calls     Seed funding calls only
  --apps      Seed sample applications only
  --reset     Clear existing seed data before seeding
  --help      Show this help message

Examples:
  ./scripts/seed.sh                # Seed all data
  ./scripts/seed.sh --users        # Seed users only
  ./scripts/seed.sh --reset --all  # Clear and reseed everything

Test Data Created:
  - Admin user: admin@funding-platform.example.com (password: Admin123!)
  - Coordinator: coordinator@funding-platform.example.com (password: Coord123!)
  - Assessor: assessor@funding-platform.example.com (password: Assess123!)
  - Applicant: applicant@funding-platform.example.com (password: Apply123!)
  - Sample funding calls with various statuses
  - Sample applications with files

EOF
}

check_database_connection() {
    log_info "Checking database connection..."

    if [ -z "${DATABASE_URL:-}" ]; then
        log_error "DATABASE_URL is not set"
        exit 1
    fi

    local db_host
    local db_port
    db_host=$(echo "$DATABASE_URL" | sed -E 's/.*@([^:]+):.*/\1/')
    db_port=$(echo "$DATABASE_URL" | sed -E 's/.*:([0-9]+)\/.*/\1/')

    if ! nc -z "$db_host" "$db_port" 2>/dev/null; then
        log_error "Cannot connect to database at ${db_host}:${db_port}"
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

seed_all() {
    log_info "Seeding all data..."
    run_npm_command "db:seed"
    log_success "All data seeded"
}

seed_users() {
    log_info "Seeding users..."
    run_npm_command "db:seed:users"
    log_success "Users seeded"
}

seed_calls() {
    log_info "Seeding funding calls..."
    run_npm_command "db:seed:calls"
    log_success "Funding calls seeded"
}

seed_apps() {
    log_info "Seeding applications..."
    run_npm_command "db:seed:apps"
    log_success "Applications seeded"
}

reset_seed_data() {
    log_warning "This will clear existing seed data. Continue? (y/N)"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Clearing seed data..."
    run_npm_command "db:seed:undo"
    log_success "Seed data cleared"
}

print_test_credentials() {
    echo ""
    echo "=============================================="
    echo "Test User Credentials"
    echo "=============================================="
    echo ""
    echo "Admin User:"
    echo "  Email: admin@funding-platform.example.com"
    echo "  Password: Admin123!"
    echo ""
    echo "Project Coordinator:"
    echo "  Email: coordinator@funding-platform.example.com"
    echo "  Password: Coord123!"
    echo ""
    echo "Assessor:"
    echo "  Email: assessor@funding-platform.example.com"
    echo "  Password: Assess123!"
    echo ""
    echo "Applicant:"
    echo "  Email: applicant@funding-platform.example.com"
    echo "  Password: Apply123!"
    echo ""
    echo "=============================================="
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    local seed_type="all"
    local reset=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --all)
                seed_type="all"
                shift
                ;;
            --users)
                seed_type="users"
                shift
                ;;
            --calls)
                seed_type="calls"
                shift
                ;;
            --apps)
                seed_type="apps"
                shift
                ;;
            --reset)
                reset=true
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
    echo "Funding Platform - Database Seeding"
    echo "=============================================="
    echo ""

    check_database_connection

    if [ "$reset" = true ]; then
        reset_seed_data
    fi

    case "$seed_type" in
        all)
            seed_all
            ;;
        users)
            seed_users
            ;;
        calls)
            seed_calls
            ;;
        apps)
            seed_apps
            ;;
    esac

    print_test_credentials
}

main "$@"
