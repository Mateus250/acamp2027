locals {
  use_custom_domain   = length(var.custom_domains) > 0
  acm_certificate_arn = var.acm_certificate_arn
}
