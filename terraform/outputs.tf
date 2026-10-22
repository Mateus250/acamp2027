output "s3_bucket_name" {
  description = "Nome do bucket S3 criado para a aplicação (adicione ao GitHub Secret: S3_BUCKET_NAME)"
  value       = module.s3_bucket.s3_bucket_id
}

output "s3_bucket_arn" {
  description = "ARN do bucket S3"
  value       = module.s3_bucket.s3_bucket_arn
}

output "cloudfront_distribution_id" {
  description = "ID da distribuição CloudFront (adicione ao GitHub Secret: CLOUDFRONT_DISTRIBUTION_ID)"
  value       = module.cloudfront.cloudfront_distribution_id
}

output "cloudfront_distribution_arn" {
  description = "ARN da distribuição CloudFront"
  value       = module.cloudfront.cloudfront_distribution_arn
}

output "cloudfront_domain_name" {
  description = "Domínio público gerado pelo CloudFront (ex: dxxxxxxxxxxxx.cloudfront.net)"
  value       = module.cloudfront.cloudfront_distribution_domain_name
}

output "website_url" {
  description = "URL completa para acessar a aplicação"
  value       = length(var.custom_domain) > 0 ? "https://${var.custom_domain}" : "https://${module.cloudfront.cloudfront_distribution_domain_name}"
}
