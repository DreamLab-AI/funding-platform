# =============================================================================
# Terraform Variables - Funding Platform
# =============================================================================

variable "aws_region" {
  description = "AWS region for UK/EU hosting (GDPR compliant)"
  type        = string
  default     = "eu-west-2" # London

  validation {
    condition     = can(regex("^eu-", var.aws_region))
    error_message = "Region must be in EU for GDPR compliance."
  }
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "funding-platform"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 50

  validation {
    condition     = var.db_allocated_storage >= 20
    error_message = "Minimum storage is 20 GB."
  }
}

variable "db_max_allocated_storage" {
  description = "RDS maximum allocated storage for autoscaling (GB)"
  type        = number
  default     = 100
}

variable "db_backup_retention_period" {
  description = "Number of days to retain backups"
  type        = number
  default     = 30

  validation {
    condition     = var.db_backup_retention_period >= 7
    error_message = "Backup retention must be at least 7 days for compliance."
  }
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for RDS"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags for resources"
  type        = map(string)
  default     = {}
}
