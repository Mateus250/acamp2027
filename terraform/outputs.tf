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
  description = "Domínio público gerado pelo CloudFront (ex: dxxxxxxxxxxxx.cloudfront.net). Aponte os domínios customizados para ele (CNAME/ALIAS)."
  value       = module.cloudfront.cloudfront_distribution_domain_name
}

output "acm_certificate_arn" {
  description = "ARN do certificado ACM usado pelo CloudFront"
  value       = try(aws_acm_certificate.site[0].arn, null)
}

output "acm_validation_records" {
  description = "Registros CNAME que devem existir no DNS de cada domínio para validar o certificado ACM"
  value = local.use_custom_domain ? {
    for o in aws_acm_certificate.site[0].domain_validation_options : o.domain_name => {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  } : {}
}

output "website_urls" {
  description = "URLs para acessar a aplicação"
  value = local.use_custom_domain ? [
    for d in var.custom_domains : "https://${d}"
  ] : ["https://${module.cloudfront.cloudfront_distribution_domain_name}"]
}

output "lambda_api_function_url" {
  description = "URL direta da Lambda Function URL"
  value       = aws_lambda_function_url.api.function_url
}

output "infinitepay_webhook_url" {
  description = "URL do Webhook a ser informada na InfinitePay"
  value       = "${var.site_url}/api/webhook"
}
