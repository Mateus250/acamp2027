variable "aws_region" {
  type        = string
  description = "Região da AWS para criação do bucket e recursos"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Nome do projeto"
  default     = "acamp2027"
}

variable "environment" {
  type        = string
  description = "Ambiente de deploy (ex: prod, staging)"
  default     = "prod"
}

variable "bucket_name" {
  type        = string
  description = "Nome customizado para o bucket S3 (opcional). Se deixado em branco, será gerado automaticamente com sufixo aleatório."
  default     = ""
}

variable "price_class" {
  type        = string
  description = "Classe de preço do CloudFront (PriceClass_100 = EUA/Europa; PriceClass_200 = inclui América do Sul/Brasil; PriceClass_All = global)"
  default     = "PriceClass_200"
}

variable "custom_domain" {
  type        = string
  description = "Domínio customizado (ex: acamp.minhaigreja.com.br). Deixe vazio para usar apenas o domínio padrão do CloudFront."
  default     = ""
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN do certificado SSL no AWS Certificate Manager (deve ser criado em us-east-1). Obrigatório caso informe custom_domain."
  default     = ""
}
