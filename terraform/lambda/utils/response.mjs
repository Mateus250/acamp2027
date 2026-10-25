// Helpers de resposta HTTP com CORS configurado

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key, Authorization',
  'Content-Type': 'application/json'
};

export function json(statusCode, data) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data, null, 2)
  };
}

export function handleOptions() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ ok: true })
  };
}
