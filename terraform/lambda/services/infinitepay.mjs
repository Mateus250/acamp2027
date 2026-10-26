// Integração com a API da InfinitePay
import { log, logError } from '../utils/logger.mjs';

function formatPhoneNumber(phone) {
  if (!phone) return null;
  const raw = String(phone).trim();
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  // Remove zeros à esquerda (ex: 019999999999)
  digits = digits.replace(/^0+/, '');

  // Formato brasileiro com DDI 55
  // 12 dígitos: 55 + DDD(2) + fixo(8)
  // 13 dígitos: 55 + DDD(2) + celular(9)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }

  // DDD(2) + 8 dígitos (fixo, total 10) ou 9 dígitos (celular, total 11)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }

  // Se o número original possuía indicativo internacional com '+' explícito e 10 a 15 dígitos
  if (raw.startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }

  // Qualquer formato fora do padrão é descartado para evitar erro 422 na InfinitePay
  return null;
}

function formatDocument(doc) {
  if (!doc) return null;
  const digits = String(doc).replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) {
    return digits;
  }
  return null;
}

function formatEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export async function createCheckoutLink({ apiKey, siteUrl, codigo, nome, valor, customer, requestId }) {
  const redirectUrl = `${siteUrl}/checkout.html?codigo=${encodeURIComponent(codigo)}&status=concluido`;
  // Webhook com o código da inscrição no path para atualização automática e direta
  const webhookUrl = `${siteUrl}/api/webhook/${encodeURIComponent(codigo)}`;
  const itemDesc = `Inscrição Acampamento 2027 (${(nome || codigo).slice(0, 35)})`;

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

  // Se foram fornecidos dados do cliente (customer), repassa para a InfinitePay
  if (customer && customer.name && String(customer.name).trim()) {
    const custObj = {
      name: String(customer.name).trim().slice(0, 100)
    };
    const validEmail = formatEmail(customer.email);
    if (validEmail) custObj.email = validEmail;

    const formattedPhone = formatPhoneNumber(customer.phone_number || customer.phone || customer.telefone);
    if (formattedPhone) custObj.phone_number = formattedPhone;

    const formattedDoc = formatDocument(customer.document || customer.cpf || customer.documento);
    if (formattedDoc) custObj.document = formattedDoc;

    payload.customer = custObj;
  }

  log('INFINITEPAY', `[${requestId}] Enviando para InfinitePay (https://api.checkout.infinitepay.io/links)...`, payload);
  const startTime = Date.now();
  let resp = await fetch('https://api.checkout.infinitepay.io/links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey
    },
    body: JSON.stringify(payload)
  });
  let duration = Date.now() - startTime;
  let resData = await resp.json().catch(async () => ({ text: await resp.text() }));

  log('INFINITEPAY', `[${requestId}] Resposta InfinitePay em ${duration}ms: HTTP ${resp.status}`, resData);

  // Se a InfinitePay rejeitar com erro (ex: 422 por validação de campos do customer),
  // realiza fallback automático tentando gerar o link sem o objeto customer para não travar o pagamento do usuário
  if (!resp.ok && payload.customer) {
    logError('INFINITEPAY', `[${requestId}] Falha ao criar link com dados do cliente (HTTP ${resp.status}). Tentando fallback sem customer...`, resData);
    const fallbackPayload = { ...payload };
    delete fallbackPayload.customer;

    const retryStart = Date.now();
    const retryResp = await fetch('https://api.checkout.infinitepay.io/links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(fallbackPayload)
    });
    const retryDuration = Date.now() - retryStart;
    const retryData = await retryResp.json().catch(async () => ({ text: await retryResp.text() }));

    log('INFINITEPAY', `[${requestId}] Resposta fallback InfinitePay em ${retryDuration}ms: HTTP ${retryResp.status}`, retryData);
    if (retryResp.ok) {
      resp = retryResp;
      resData = retryData;
    }
  }

  if (!resp.ok) {
    logError('INFINITEPAY', `[${requestId}] Erro retornado pela InfinitePay: HTTP ${resp.status}`, resData);
    return { ok: false, status: resp.status, data: resData };
  }

  const url = resData.url || resData.link || (resData.data && (resData.data.url || resData.data.link));
  return { ok: true, url, raw: resData };
}

export async function checkPaymentDirect({ apiKey, orderNsu, transactionNsu, slug, handle, requestId }) {
  if (!apiKey || !orderNsu) return null;
  const body = { order_nsu: orderNsu };
  if (transactionNsu) body.transaction_nsu = transactionNsu;
  if (slug) body.slug = slug;
  if (handle) body.handle = handle;

  log('INFINITEPAY', `[${requestId}] Chamando payment_check para order_nsu='${orderNsu}'...`, body);
  try {
    const res = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(async () => ({ text: await res.text() }));
    log('INFINITEPAY', `[${requestId}] Resposta payment_check (HTTP ${res.status}):`, data);

    const isPaid = res.ok && (
      data.success === true ||
      data.paid === true ||
      data.status === 'paid' ||
      data.event === 'paid' ||
      Number(data.paid_amount) > 0
    );

    return {
      ok: res.ok,
      paid: isPaid,
      raw: data,
      paid_amount: data.paid_amount || data.amount || null,
      capture_method: data.capture_method || null,
      transaction_nsu: data.transaction_nsu || transactionNsu || null,
      receipt_url: data.receipt_url || null
    };
  } catch (err) {
    logError('INFINITEPAY', `[${requestId}] Erro ao chamar payment_check:`, err);
    return null;
  }
}
