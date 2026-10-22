resource "random_string" "bucket_suffix" {
  length  = 6
  special = false
  upper   = false
}

locals {
  bucket_name = length(var.bucket_name) > 0 ? var.bucket_name : "${var.project_name}-${var.environment}-${random_string.bucket_suffix.result}"
}

# Módulo da comunidade para criação e configuração segura do S3
module "s3_bucket" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "~> 4.0"

  bucket        = local.bucket_name
  force_destroy = false

  # Bloqueio total de acesso público direto (acesso apenas via CloudFront OAC)
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true

  # Versionamento de objetos
  versioning = {
    enabled = true
  }

  # Criptografia SSE-S3
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
    }
  }
}

# Política do bucket permitindo leitura exclusiva para a distribuição CloudFront via OAC
data "aws_iam_policy_document" "s3_policy" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    actions   = ["s3:GetObject"]
    resources = ["${module.s3_bucket.s3_bucket_arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [module.cloudfront.cloudfront_distribution_arn]
    }
  }
}

resource "aws_s3_bucket_policy" "bucket_policy" {
  bucket = module.s3_bucket.s3_bucket_id
  policy = data.aws_iam_policy_document.s3_policy.json
}
