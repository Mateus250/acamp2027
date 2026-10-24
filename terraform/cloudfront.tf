# CloudFront Function para reescrever URLs limpas (como /admin para /admin.html e /checkout para /checkout.html)
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "${var.project_name}-${var.environment}-url-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Reescreve URLs amigaveis na borda (ex: /admin para /admin.html, /checkout para /checkout.html)"
  publish = true
  code    = <<-EOF
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Nao altera rotas de API
    if (uri.startsWith('/api')) {
        return request;
    }

    // Se acessar /admin ou /admin/, redireciona internamente para /admin/index.html
    if (uri === '/admin' || uri === '/admin/') {
        request.uri = '/admin/index.html';
        return request;
    }

    // Se acessar /checkout ou /checkout/, redireciona internamente para /checkout.html
    if (uri === '/checkout' || uri === '/checkout/') {
        request.uri = '/checkout.html';
        return request;
    }

    // Se a URL terminar em /, anexa index.html
    if (uri.endsWith('/')) {
        request.uri += 'index.html';
    } 
    // Se nao tiver extensao de arquivo (ex: /sobre), anexa .html
    else if (!uri.includes('.')) {
        request.uri += '.html';
    }

    return request;
}
EOF
}

# Módulo da comunidade para criação e distribuição otimizada do CloudFront
module "cloudfront" {
  source  = "terraform-aws-modules/cloudfront/aws"
  version = "~> 3.4"

  comment             = "Distribuicao CloudFront para ${var.project_name} (${var.environment})"
  enabled             = true
  is_ipv6_enabled     = true
  price_class         = var.price_class
  default_root_object = "index.html"

  # Todos os domínios customizados (ex: acampimersos.com.br e acampamentoipi.com.br)
  aliases = var.custom_domains

  # Origin Access Control (OAC) gerenciado de forma segura pelo módulo
  create_origin_access_control = true
  origin_access_control = {
    s3_oac = {
      description      = "OAC para o bucket S3 do ${var.project_name}"
      origin_type      = "s3"
      signing_behavior = "always"
      signing_protocol = "sigv4"
    }
  }

  origin = {
    s3_oac = {
      domain_name           = module.s3_bucket.s3_bucket_bucket_regional_domain_name
      origin_access_control = "s3_oac"
    }
    lambda_api = {
      domain_name = replace(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/", "")
      custom_origin_config = {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Rota para chamadas de API (Checkout e Webhook da InfinitePay)
  ordered_cache_behavior = [
    {
      path_pattern           = "/api/*"
      target_origin_id       = "lambda_api"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true
      use_forwarded_values   = false

      # AWS Managed Cache Policy: CachingDisabled (ID: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
      cache_policy_id = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"

      # AWS Managed Origin Request Policy: AllViewerExceptHostHeader (ID: b684b08a-5e13-4170-9704-05a201c738e1)
      origin_request_policy_id = "b684b08a-5e13-4170-9704-05a201c738e1"
    }
  ]

  default_cache_behavior = {
    target_origin_id       = "s3_oac"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    use_forwarded_values = false

    # AWS Managed Cache Policy: CachingOptimized (ID: 658327ea-f89d-4fab-a63d-7e88639e58f6)
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

    # Associação da CloudFront Function para reescrever URLs
    function_association = {
      viewer-request = {
        function_arn = aws_cloudfront_function.url_rewrite.arn
      }
    }
  }

  # Redirecionamento amigável para index.html (SPA / rotas client-side)
  custom_error_response = [
    {
      error_caching_min_ttl = 10
      error_code            = 403
      response_code         = 200
      response_page_path    = "/index.html"
    },
    {
      error_caching_min_ttl = 10
      error_code            = 404
      response_code         = 200
      response_page_path    = "/index.html"
    }
  ]

  geo_restriction = {
    restriction_type = "none"
  }

  # Usa o ARN vindo do recurso de validação para garantir que o certificado
  # já esteja emitido (ISSUED) antes de ser associado à distribuição.
  viewer_certificate = local.use_custom_domain ? {
    acm_certificate_arn      = aws_acm_certificate_validation.site[0].certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
    } : {
    cloudfront_default_certificate = true
  }
}
