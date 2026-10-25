// Utilitários de parsing de requisições e normalização de caminhos
import { logError } from './logger.mjs';

export function parseBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    logError('PARSER', 'Falha ao converter body para JSON', err.message);
    return {};
  }
}

export function getPath(event) {
  const p = event.rawPath || (event.requestContext && event.requestContext.http && event.requestContext.http.path) || '/';
  return p.replace(/^\/api/, ''); // remove prefixo /api se presente
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
