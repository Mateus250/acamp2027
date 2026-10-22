# CloudFront Function para reescrever URLs limpas (como /admin para /admin.html)
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "${var.project_name}-${var.environment}-url-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Reescreve URLs amigaveis na borda (ex: /admin para /admin.html)"
  publish = true
  code    = <<-EOF
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Se acessar /admin ou /admin/, redireciona internamente para /admin.html
    if (uri === '/admin' || uri === '/admin/') {
        request.uri = '/admin/index.html';
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

  aliases = length(var.custom_domain) > 0 ? [var.custom_domain] : []

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
  }

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

  viewer_certificate = length(var.custom_domain) > 0 ? {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  } : {
    cloudfront_default_certificate = true
  }
}
