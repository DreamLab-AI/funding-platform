#!/usr/bin/env bash
# =============================================================================
# Database Backup Script
# Funding Application Platform
# =============================================================================
# Usage: ./scripts/backup.sh [options]
# Options:
#   --full        Full backup including files
#   --db-only     Database only (default)
#   --to-s3       Upload to S3
#   --restore     Restore from backup
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
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load environment variables
if [ -f "${PROJECT_ROOT}/.env" ]; then
    set -a
    source "${PROJECT_ROOT}/.env"
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
Funding Platform - Database Backup Script

Usage: ./scripts/backup.sh [options]

Options:
  --full        Full backup (database + uploaded files)
  --db-only     Database backup only (default)
  --to-s3       Upload backup to S3 after creation
  --restore     Restore from a backup file
  --list        List available backups
  --cleanup     Remove old backups (keeps last 30 days)
  --help        Show this help message

Examples:
  ./scripts/backup.sh                    # Create database backup
  ./scripts/backup.sh --full --to-s3     # Full backup and upload to S3
  ./scripts/backup.sh --restore <file>   # Restore from backup
  ./scripts/backup.sh --list             # List available backups
  ./scripts/backup.sh --cleanup          # Remove old backups

Environment Variables:
  DATABASE_URL     PostgreSQL connection string
  BACKUP_S3_BUCKET S3 bucket for backups (optional)
  AWS_REGION       AWS region (default: eu-west-2)

EOF
}

ensure_backup_dir() {
    mkdir -p "$BACKUP_DIR"
}

create_db_backup() {
    log_info "Creating database backup..."

    if [ -z "${DATABASE_URL:-}" ]; then
        log_error "DATABASE_URL is not set"
        exit 1
    fi

    local backup_file="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

    # Check if running in Docker or locally
    if docker exec funding_platform_db pg_isready &>/dev/null; then
        # Database is in Docker
        log_info "Backing up from Docker container..."
        docker exec funding_platform_db pg_dump -U postgres -d funding_platform | gzip > "$backup_file"
    else
        # Database is external
        log_info "Backing up from external database..."
        pg_dump "$DATABASE_URL" | gzip > "$backup_file"
    fi

    local size=$(du -h "$backup_file" | cut -f1)
    log_success "Database backup created: $backup_file ($size)"

    echo "$backup_file"
}

create_files_backup() {
    log_info "Creating files backup..."

    local uploads_dir="${PROJECT_ROOT}/uploads"
    local backup_file="${BACKUP_DIR}/files_backup_${TIMESTAMP}.tar.gz"

    if [ -d "$uploads_dir" ] && [ "$(ls -A $uploads_dir 2>/dev/null)" ]; then
        tar -czf "$backup_file" -C "${PROJECT_ROOT}" uploads
        local size=$(du -h "$backup_file" | cut -f1)
        log_success "Files backup created: $backup_file ($size)"
        echo "$backup_file"
    else
        log_warning "No files to backup in $uploads_dir"
        echo ""
    fi
}

create_full_backup() {
    log_info "Creating full backup..."

    local db_backup=$(create_db_backup)
    local files_backup=$(create_files_backup)

    # Create combined archive
    local combined_file="${BACKUP_DIR}/full_backup_${TIMESTAMP}.tar.gz"

    cd "$BACKUP_DIR"
    local files_to_archive=("$(basename $db_backup)")

    if [ -n "$files_backup" ]; then
        files_to_archive+=("$(basename $files_backup)")
    fi

    tar -czf "$combined_file" "${files_to_archive[@]}"

    # Clean up individual files
    rm -f "$db_backup"
    [ -n "$files_backup" ] && rm -f "$files_backup"

    local size=$(du -h "$combined_file" | cut -f1)
    log_success "Full backup created: $combined_file ($size)"

    echo "$combined_file"
}

upload_to_s3() {
    local backup_file="$1"

    if [ -z "${BACKUP_S3_BUCKET:-}" ]; then
        log_error "BACKUP_S3_BUCKET is not set"
        exit 1
    fi

    log_info "Uploading to S3: s3://${BACKUP_S3_BUCKET}/..."

    aws s3 cp "$backup_file" "s3://${BACKUP_S3_BUCKET}/backups/$(basename $backup_file)" \
        --region "${AWS_REGION:-eu-west-2}" \
        --storage-class STANDARD_IA

    log_success "Uploaded to S3: s3://${BACKUP_S3_BUCKET}/backups/$(basename $backup_file)"
}

restore_backup() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi

    log_warning "This will OVERWRITE the current database. Continue? (y/N)"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        log_info "Aborted."
        exit 0
    fi

    log_info "Restoring from: $backup_file"

    if [[ "$backup_file" == *"full_backup"* ]]; then
        # Extract full backup
        local temp_dir=$(mktemp -d)
        tar -xzf "$backup_file" -C "$temp_dir"

        # Find and restore database
        local db_file=$(find "$temp_dir" -name "db_backup_*.sql.gz" | head -1)
        if [ -n "$db_file" ]; then
            restore_database "$db_file"
        fi

        # Find and restore files
        local files_archive=$(find "$temp_dir" -name "files_backup_*.tar.gz" | head -1)
        if [ -n "$files_archive" ]; then
            log_info "Restoring uploaded files..."
            tar -xzf "$files_archive" -C "${PROJECT_ROOT}"
            log_success "Files restored"
        fi

        rm -rf "$temp_dir"
    elif [[ "$backup_file" == *".sql.gz" ]]; then
        restore_database "$backup_file"
    else
        log_error "Unknown backup format"
        exit 1
    fi

    log_success "Restore completed"
}

restore_database() {
    local db_file="$1"

    log_info "Restoring database..."

    if docker exec funding_platform_db pg_isready &>/dev/null; then
        gunzip -c "$db_file" | docker exec -i funding_platform_db psql -U postgres -d funding_platform
    else
        gunzip -c "$db_file" | psql "$DATABASE_URL"
    fi

    log_success "Database restored"
}

list_backups() {
    log_info "Available backups:"
    echo ""

    if [ -d "$BACKUP_DIR" ] && [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
        ls -lh "$BACKUP_DIR"/*.{sql.gz,tar.gz} 2>/dev/null | awk '{print $9, $5}'
    else
        log_warning "No backups found in $BACKUP_DIR"
    fi

    # List S3 backups if configured
    if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
        echo ""
        log_info "S3 backups:"
        aws s3 ls "s3://${BACKUP_S3_BUCKET}/backups/" --region "${AWS_REGION:-eu-west-2}" 2>/dev/null || \
            log_warning "Could not list S3 backups"
    fi
}

cleanup_old_backups() {
    local retention_days="${1:-30}"

    log_info "Cleaning up backups older than $retention_days days..."

    local count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((count++))
        log_info "Removed: $(basename $file)"
    done < <(find "$BACKUP_DIR" -name "*.gz" -mtime +$retention_days -print0 2>/dev/null)

    if [ $count -eq 0 ]; then
        log_info "No old backups to remove"
    else
        log_success "Removed $count old backup(s)"
    fi
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    local mode="db-only"
    local upload_s3=false
    local restore_file=""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --full)
                mode="full"
                shift
                ;;
            --db-only)
                mode="db-only"
                shift
                ;;
            --to-s3)
                upload_s3=true
                shift
                ;;
            --restore)
                mode="restore"
                restore_file="${2:-}"
                shift 2 || shift
                ;;
            --list)
                mode="list"
                shift
                ;;
            --cleanup)
                mode="cleanup"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                # Check if it's a backup file for restore
                if [ -f "$1" ]; then
                    mode="restore"
                    restore_file="$1"
                else
                    log_error "Unknown option: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done

    echo "=============================================="
    echo "Funding Platform - Backup Management"
    echo "=============================================="
    echo ""

    ensure_backup_dir

    case "$mode" in
        db-only)
            local backup_file=$(create_db_backup)
            if [ "$upload_s3" = true ]; then
                upload_to_s3 "$backup_file"
            fi
            ;;
        full)
            local backup_file=$(create_full_backup)
            if [ "$upload_s3" = true ]; then
                upload_to_s3 "$backup_file"
            fi
            ;;
        restore)
            if [ -z "$restore_file" ]; then
                log_error "Please specify a backup file to restore"
                exit 1
            fi
            restore_backup "$restore_file"
            ;;
        list)
            list_backups
            ;;
        cleanup)
            cleanup_old_backups
            ;;
    esac
}

main "$@"
