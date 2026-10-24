# Infraestrutura com Terraform: AWS S3 + CloudFront + Lambda (API & InfinitePay)

Este diretório contém a infraestrutura como código (IaC) para hospedar a aplicação web do acampamento e a API backend serverless com alta performance, segurança e baixa latência, utilizando os módulos oficiais mantidos pela comunidade (`terraform-aws-modules`).

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
  - **Roteamento de API (`/api/*`)**: Encaminhamento direto para a Lambda com cache desabilitado.
- **Lambda & API Serverless (`lambda.tf` e `lambda/index.mjs`)**:
  - Runtime Node.js 20.x nativo.
  - Geração de checkout na API da InfinitePay.
  - Webhook oficial para confirmação automática de pagamentos e baixa no Supabase.
- **Remote State no S3 (`providers.tf`)**:
  - Estado armazenado com versionamento e criptografia no bucket `acamp2027-terraform-state-prod`.
  - Permite que o pipeline do GitHub Actions execute `terraform apply` de forma segura e compartilhada.

---

## 🚀 Passo a Passo: Provisionar a Infraestrutura

### 1. Pré-requisitos
- [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) (>= 1.5.0) instalado.
- [AWS CLI](https://aws.amazon.com/cli/) instalado e configurado (`aws configure`) com credenciais que tenham permissões para S3, CloudFront, Lambda e IAM.

### 2. Inicializar o Terraform
No terminal, entre no diretório `terraform/`:
```bash
cd terraform
terraform init
```

### 3. Configurar Variáveis
Crie um arquivo `terraform.tfvars` baseado no exemplo `terraform.tfvars.example`:
```bash
cp terraform.tfvars.example terraform.tfvars
```
Preencha a `infinitepay_api_key` e a `supabase_service_role_key`.

### 4. Planejar e Aplicar
```bash
terraform plan
terraform apply
```

---

## 🔐 Configurar GitHub Secrets para a Pipeline CI/CD

No repositório do seu projeto no GitHub, acesse:
**Settings > Secrets and variables > Actions > New repository secret**

Adicione as seguintes secrets:

| Secret | Descrição | Exemplo de Valor |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | Chave de acesso do usuário IAM na AWS | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | Chave secreta do usuário IAM na AWS | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_REGION` | Região AWS utilizada | `us-east-1` |
| `INFINITEPAY_API_KEY` | Chave de API da InfinitePay (`inchk_...`) | `inchk_xxxxxxxxxxxxxxxx` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` secreta do Supabase | `eyJhbGciOi...` |
| `S3_BUCKET_NAME` | *(Opcional)* Nome do bucket S3 (fallback automático via Terraform output) | `acamp2027-prod-xxxxxx` |
| `CLOUDFRONT_DISTRIBUTION_ID` | *(Opcional)* ID da distribuição CloudFront (fallback automático via Terraform output) | `E1XXXXXXXXXXXX` |

---

## 📦 Como Funciona o Deploy Automático

Ao realizar um `git push` na branch `main`:

1. O GitHub Actions faz checkout do código e autentica na AWS.
2. **Executa o Terraform**:
   - Conecta ao S3 Remote Backend (`acamp2027-terraform-state-prod`).
   - Empacota o código atualizado da Lambda (`lambda/index.mjs`).
   - Executa `terraform apply -auto-approve`, atualizando a Lambda, as variáveis de ambiente e as configurações do CloudFront.
3. Sincroniza fontes (`/fontes`) com cache imutável.
4. Sincroniza fotos (`/fotos`) com cache de 7 dias.
5. Sincroniza os arquivos web (`index.html`, `checkout.html`, `app.js`, `estilo.css`, etc.).
6. Executa a invalidação global no CloudFront (`/*`), deixando todo o frontend e as rotas de API imediatamente atualizados.
