# Infraestrutura com Terraform: AWS S3 + CloudFront (Módulos da Comunidade)

Este diretório contém a infraestrutura como código (IaC) para hospedar a aplicação web estática do acampamento com alta performance, segurança e baixa latência, utilizando os módulos oficiais mantidos pela comunidade (`terraform-aws-modules`).

## 🧱 Arquitetura e Módulos Utilizados

- **S3 (`s3.tf`)**: Utiliza o módulo [`terraform-aws-modules/s3-bucket/aws`](https://registry.terraform.io/modules/terraform-aws-modules/s3-bucket/aws/latest).
  - Bloqueio total de acesso público direto (`Public Access Block`).
  - Criptografia em repouso AES-256 (`SSE-S3`).
  - Versionamento ativado.
  - Bucket policy estrita permitindo acesso somente ao CloudFront via OAC.
- **CloudFront (`cloudfront.tf`)**: Utiliza o módulo [`terraform-aws-modules/cloudfront/aws`](https://registry.terraform.io/modules/terraform-aws-modules/cloudfront/aws/latest).
  - **Origin Access Control (OAC)** nativo gerenciado pelo módulo.
  - **Cache Otimizado**: Política gerenciada `CachingOptimized` da AWS com compressão gzip/brotli automática.
  - **Edge Locations**: Configurado por padrão em `PriceClass_200` (inclui pontos de presença no Brasil/América do Sul).
  - **Single Page Application (SPA)**: Respostas 403 e 404 redirecionadas para `/index.html` com código 200.
- **Definições Gerais**:
  - `providers.tf`: Provider AWS e Random com tags automáticas de projeto.
  - `variables.tf`: Variáveis de entrada (região, ambiente, domínio customizado, certificado ACM).
  - `outputs.tf`: Exportações necessárias para a pipeline do GitHub Actions.

---

## 🚀 Passo a Passo: Provisionar a Infraestrutura

### 1. Pré-requisitos
- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) (>= 1.5.0) instalado.
- [AWS CLI](https://aws.amazon.com/cli/) instalado e configurado (`aws configure`) com credenciais que tenham permissões para S3 e CloudFront.

### 2. Inicializar o Terraform e Baixar os Módulos
No terminal, entre no diretório `terraform/`:
```bash
cd terraform
terraform init
```

### 3. Configurar Variáveis (Opcional)
Se desejar customizar região, nome ou domínio, crie um arquivo `terraform.tfvars` baseado no exemplo:
```bash
cp terraform.tfvars.example terraform.tfvars
```

### 4. Planejar e Aplicar
```bash
terraform plan
terraform apply
```
Digite `yes` para confirmar a criação.

Ao finalizar, o Terraform exibirá os `outputs`:
```text
cloudfront_distribution_id = "E1XXXXXXXXXXXX"
cloudfront_domain_name     = "d111111abcdef8.cloudfront.net"
s3_bucket_name             = "acamp2027-prod-xxxxxx"
website_url                = "https://d111111abcdef8.cloudfront.net"
```

---

## 🔐 Configurar GitHub Secrets para a Pipeline CI/CD

No repositório do seu projeto no GitHub, acesse:
**Settings > Secrets and variables > Actions > New repository secret**

Adicione as seguintes secrets com os valores gerados pelo Terraform:

| Secret | Descrição | Exemplo de Valor |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Chave de acesso do usuário IAM na AWS | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Chave secreta do usuário IAM na AWS | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Região AWS utilizada | `us-east-1` |
| `S3_BUCKET_NAME` | Nome do bucket gerado no output `s3_bucket_name` | `acamp2027-prod-xxxxxx` |
| `CLOUDFRONT_DISTRIBUTION_ID` | ID gerado no output `cloudfront_distribution_id` | `E1XXXXXXXXXXXX` |

---

## 📦 Como Funciona o Deploy

Assim que você fizer um `git push` na branch `main` (ou acionar o workflow manualmente em **Actions > Deploy to AWS S3 & CloudFront > Run workflow**):

1. O GitHub Actions realiza checkout do projeto.
2. Sincroniza fontes (`/fontes`) com cabeçalho `Cache-Control: public, max-age=31536000, immutable`.
3. Sincroniza fotos (`/fotos`) com cabeçalho `Cache-Control: public, max-age=604800`.
4. Sincroniza os arquivos de aplicação (`index.html`, `app.js`, `estilo.css`, `qrcode.min.js`) com `Cache-Control: public, max-age=0, must-revalidate`.
5. Executa a invalidação de cache no CloudFront (`aws cloudfront create-invalidation --paths "/*"`), garantindo que as alterações fiquem disponíveis instantaneamente para todos os usuários.
