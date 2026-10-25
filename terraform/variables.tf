variable "aws_region" {
  type        = string
  description = "Regiao da AWS onde os recursos serao provisionados"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Nome base do projeto para identificacao dos recursos (ex.: acamp2027)"
  default     = "acamp2027"
}

variable "environment" {
  type        = string
  description = "Ambiente de execucao (prod, staging, dev)"
  default     = "prod"
}

variable "bucket_name" {
  type        = string
  description = "Nome customizado para o bucket S3 (opcional). Se deixado em branco, sera gerado automaticamente com sufixo aleatorio."
  default     = ""
}

variable "price_class" {
  type        = string
  description = "Classe de preco do CloudFront: PriceClass_100 (Americas/Europa), PriceClass_200 (inclui Brasil/SA), PriceClass_All (global)"
  default     = "PriceClass_200"
}

variable "custom_domains" {
  type        = list(string)
  description = "Domínios customizados atendidos pela distribuição CloudFront. O primeiro é o domínio principal do certificado ACM; os demais entram como SANs. Deixe vazio para usar apenas o domínio padrão do CloudFront."
  default = [
    "acampimersos.com.br",
    "acampamentoipi.com.br",
  ]
}

variable "infinitepay_api_key" {
  type        = string
  description = "API Key da InfinitePay (inchk_...) para gerar checkouts e consultar pagamentos"
  sensitive   = true
  default     = ""
}

variable "supabase_url" {
  type        = string
  description = "URL do projeto Supabase"
  default     = "https://xhtnhhdpiuqdquacooau.supabase.co"
}

variable "supabase_service_role_key" {
  type        = string
  description = "Chave service_role secreta do Supabase para atualizar o status dos acampantes no webhook"
  sensitive   = true
  default     = ""
}

variable "site_url" {
  type        = string
  description = "URL base pública do site para redirects e webhooks"
  default     = "https://acampamentoipi.com.br"
}
