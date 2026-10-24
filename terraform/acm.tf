locals {
  use_custom_domain = length(var.custom_domains) > 0
}

# Certificado SSL para todos os domínios customizados.
# Certificados usados pelo CloudFront precisam obrigatoriamente estar em us-east-1.
resource "aws_acm_certificate" "site" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.custom_domains[0]
  subject_alternative_names = slice(var.custom_domains, 1, length(var.custom_domains))
  validation_method         = "DNS"

  tags = {
    Name = "${var.project_name}-${var.environment}"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Aguarda a validação DNS do certificado.
# Os registros CNAME (output "acm_validation_records") devem ser criados manualmente
# nos provedores de DNS (NS1 para acampimersos.com.br, Locaweb para acampamentoipi.com.br).
resource "aws_acm_certificate_validation" "site" {
  count    = local.use_custom_domain ? 1 : 0
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.site[0].arn

  timeouts {
    create = "2h"
  }
}
