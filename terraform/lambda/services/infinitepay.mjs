// Integração com a API da InfinitePay
import { log, logError } from '../utils/logger.mjs';

export async function createCheckoutLink({ apiKey, siteUrl, codigo, nome, valor, requestId }) {
  const redirectUrl = `${siteUrl}/checkout.html?codigo=${encodeURIComponent(codigo)}&status=concluido`;
  const webhookUrl = `${siteUrl}/api/webhook`;
  const itemDesc = `Inscrição Imersos 2027 (${(nome || codigo).slice(0, 35)})`;

  const payload = {
    order_nsu: codigo,
    redirect_url: redirectUrl,
    webhook_url: webhookUrl,
    items: [
      {
        description: itemDesc,
        quantity: 1,
        price: Math.round(Number(valor))
      }
    ],
    webhook: {
      url: webhookUrl,
      events: ['paid', 'settled']
    }
  };

  log('INFINITEPAY', `[${requestId}] Enviando para InfinitePay (https://api.checkout.infinitepay.io/links)...`, payload);
  const startTime = Date.now();
  const resp = await fetch('https://api.checkout.infinitepay.io/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(payload)
  });
  const duration = Date.now() - startTime;
  const resData = await resp.json().catch(async () => ({ text: await resp.text() }));

  log('INFINITEPAY', `[${requestId}] Resposta InfinitePay em ${duration}ms: HTTP ${resp.status}`, resData);
  if (!resp.ok) {
    logError('INFINITEPAY', `[${requestId}] Erro retornado pela InfinitePay: HTTP ${resp.status}`, resData);
    return { ok: false, status: resp.status, data: resData };
  }

  const url = resData.url || resData.link || (resData.data && (resData.data.url || resData.data.link));
  return { ok: true, url, raw: resData };
}

export async function checkPaymentDirect({ apiKey, orderNsu, requestId }) {
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify({ order_nsu: orderNsu })
    });
    if (!res.ok) {
      logError('INFINITEPAY', `[${requestId}] payment_check HTTP ${res.status}:`, await res.text());
      return null;
    }
    const data = await res.json();
    log('INFINITEPAY', `[${requestId}] Resposta payment_check:`, data);
    return data;
  } catch (err) {
    logError('INFINITEPAY', `[${requestId}] Exceção no payment_check:`, err.message);
    return null;
  }
}
