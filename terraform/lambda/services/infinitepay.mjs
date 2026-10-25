// Integração com a API da InfinitePay
import { log, logError } from '../utils/logger.mjs';

function formatPhoneNumber(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return `+${digits}`;
}

function formatDocument(doc) {
  if (!doc) return null;
  const digits = String(doc).replace(/\D/g, '');
  return digits.length === 11 ? digits : digits || null;
}

export async function createCheckoutLink({ apiKey, siteUrl, codigo, nome, valor, customer, requestId }) {
  const redirectUrl = `${siteUrl}/checkout.html?codigo=${encodeURIComponent(codigo)}&status=concluido`;
  // Webhook com o código da inscrição no path para atualização automática e direta
  const webhookUrl = `${siteUrl}/api/webhook/${encodeURIComponent(codigo)}`;
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

  // Se foram fornecidos dados do cliente (customer), repassa para a InfinitePay
  if (customer && customer.name) {
    const custObj = {
      name: customer.name.slice(0, 100)
    };
    if (customer.email) custObj.email = customer.email.trim().toLowerCase();
    const formattedPhone = formatPhoneNumber(customer.phone_number || customer.phone || customer.telefone);
    if (formattedPhone) custObj.phone_number = formattedPhone;
    const formattedDoc = formatDocument(customer.document || customer.cpf || customer.documento);
    if (formattedDoc) custObj.document = formattedDoc;

    payload.customer = custObj;
  }

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
