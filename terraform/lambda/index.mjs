// Lambda Function Principal - Acampamento IMERSOS 2027
// Roteador modular para Checkout, Webhook, Status e Inscrições

import { log, logError } from './utils/logger.mjs';
import { handleOptions, json } from './utils/response.mjs';
import { parseBody, getPath } from './utils/parser.mjs';
import { getEnv, maskSecret } from './config/env.mjs';
import { handleCheckout } from './routes/checkout.mjs';
import { handleWebhook } from './routes/webhook.mjs';
import { handleInscricoes } from './routes/inscricoes.mjs';
import { handleStatus } from './routes/status.mjs';
import { handleSendEmail } from './routes/send-email.mjs';

export const handler = async (event) => {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();
  const rawPath = event.rawPath || event.requestContext?.http?.path || '/';
  const path = getPath(event);
  const requestId = event.requestContext?.requestId || 'req-' + Math.random().toString(36).slice(2, 8);

  log('REQ_INIT', `[${requestId}] Requisição: ${method} ${rawPath} (rota normalizada: ${path})`);

  // Resposta para pre-flight CORS
  if (method === 'OPTIONS') {
    log('CORS', `[${requestId}] Respondendo 200 para pre-flight OPTIONS`);
    return handleOptions();
  }

  const env = getEnv();
  log('ENV_DIAG', `[${requestId}] Configurações ativas:`, {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: maskSecret(env.SUPABASE_SERVICE_ROLE_KEY),
    INFINITEPAY_API_KEY: maskSecret(env.INFINITEPAY_API_KEY),
    SITE_URL: env.SITE_URL
  });

  // -------------------------------------------------------------------------
  // ROTA 1: GET /inscricoes (ou /api/inscricoes, /teste, /health)
  // -------------------------------------------------------------------------
  if (method === 'GET' && (path === '/inscricoes' || path === '/teste' || path === '/health')) {
    return await handleInscricoes(env, requestId);
  }

  // -------------------------------------------------------------------------
  // ROTA 2: POST /checkout (ou /api/checkout) -> Cria link na API da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && (path === '/checkout' || path === '')) {
    const body = parseBody(event);
    return await handleCheckout(body, env, requestId);
  }

  // -------------------------------------------------------------------------
  // ROTA 3: POST /webhook ou /webhook/:codigo -> Recebe notificação da InfinitePay
  // -------------------------------------------------------------------------
  if (method === 'POST' && (path === '/webhook' || path.startsWith('/webhook/'))) {
    const body = parseBody(event);
    const pathCodigo = path.startsWith('/webhook/') ? decodeURIComponent(path.slice('/webhook/'.length).trim()) : null;
    return await handleWebhook(body, env, requestId, pathCodigo);
  }

  // -------------------------------------------------------------------------
  // ROTA 4: GET /status (ou /api/status?codigo=IMR-XXXX ou ?documento=123...)
  // -------------------------------------------------------------------------
  if (method === 'GET' && path === '/status') {
    return await handleStatus(event.queryStringParameters, env, requestId);
  }

  // -------------------------------------------------------------------------
  // ROTA 5: POST /send-email (ou /api/send-email) -> Envio manual/reenvio de e-mail com QR Code
  // -------------------------------------------------------------------------
  if (method === 'POST' && (path === '/send-email' || path === '/email')) {
    const body = parseBody(event);
    return await handleSendEmail(body, env, requestId);
  }

  // -------------------------------------------------------------------------
  // ROTA NÃO ENCONTRADA (404)
  // -------------------------------------------------------------------------
  logError('NOT_FOUND', `[${requestId}] Rota não encontrada: ${method} ${path}`);
  return json(404, {
    error: `Rota não encontrada: ${method} ${path}`,
    rotas_disponiveis: [
      'GET /api/inscricoes',
      'POST /api/checkout',
      'POST /api/webhook',
      'POST /api/webhook/:codigo',
      'GET /api/status?codigo=IMR-XXXX',
      'GET /api/status?documento=00000000000',
      'POST /api/send-email'
    ]
  });
};
