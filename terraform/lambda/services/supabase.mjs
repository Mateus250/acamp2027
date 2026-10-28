// Consultas e atualizações no Supabase
import { log, logError } from '../utils/logger.mjs';
import { maskSecret } from '../config/env.mjs';

export async function fetchInscricoes({ supabaseUrl, authKey, requestId }) {
  const searchUrl = `${supabaseUrl}/rest/v1/acampantes?select=*`;
  log('SUPABASE', `[${requestId}] Chamando: ${searchUrl} usando chave: ${maskSecret(authKey)}`);

  const startTime = Date.now();
  const searchRes = await fetch(searchUrl, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`
    }
  });
  const duration = Date.now() - startTime;
  log('SUPABASE', `[${requestId}] Resposta Supabase em ${duration}ms: HTTP ${searchRes.status} ${searchRes.statusText}`);

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    logError('SUPABASE', `[${requestId}] Falha na resposta do Supabase:`, { status: searchRes.status, body: errText });
    throw new Error(`Erro ao conectar com Supabase: ${searchRes.statusText} (${errText})`);
  }

  return await searchRes.json();
}

export async function findAcampanteByCodigo({ supabaseUrl, authKey, codigo, requestId }) {
  const searchUrl = `${supabaseUrl}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}&select=*`;
  log('SUPABASE', `[${requestId}] Buscando acampante por código: ${searchUrl}`);

  const searchRes = await fetch(searchUrl, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`
    }
  });

  if (!searchRes.ok) {
    logError('SUPABASE', `[${requestId}] Falha ao buscar acampante: HTTP ${searchRes.status}`, await searchRes.text());
    return null;
  }

  const list = await searchRes.json();
  return Array.isArray(list) && list.length ? list[0] : null;
}

export async function findAcampanteByDocumento({ supabaseUrl, authKey, documento, requestId }) {
  const digits = String(documento).replace(/\D/g, '');
  if (!digits) return null;

  // Busca em obs contendo CPF: <digitos>
  const searchUrl = `${supabaseUrl}/rest/v1/acampantes?obs=ilike.*CPF:%20*${encodeURIComponent(digits)}*&select=*`;
  log('SUPABASE', `[${requestId}] Buscando acampante por documento/CPF: ${searchUrl}`);

  const searchRes = await fetch(searchUrl, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`
    }
  });

  if (!searchRes.ok) {
    logError('SUPABASE', `[${requestId}] Falha ao buscar acampante por documento: HTTP ${searchRes.status}`, await searchRes.text());
    return null;
  }

  const list = await searchRes.json();
  return Array.isArray(list) && list.length ? list[0] : null;
}

export async function updateAcampante({ supabaseUrl, authKey, codigo, updateData, requestId }) {
  const updateUrl = `${supabaseUrl}/rest/v1/acampantes?codigo=eq.${encodeURIComponent(codigo)}`;
  log('SUPABASE', `[${requestId}] Atualizando acampante ${codigo}:`, updateData);

  const updateRes = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(updateData)
  });

  const resData = await updateRes.json().catch(async () => ({ text: await updateRes.text() }));
  log('SUPABASE', `[${requestId}] Resposta atualização: HTTP ${updateRes.status}`, resData);

  return { ok: updateRes.ok, status: updateRes.status, data: resData };
}

export async function insertAcampante({ supabaseUrl, authKey, acampanteData, requestId }) {
  const insertUrl = `${supabaseUrl}/rest/v1/acampantes`;
  log('SUPABASE', `[${requestId}] Inserindo novo acampante:`, { codigo: acampanteData.codigo, nome: acampanteData.nome });

  const insertRes = await fetch(insertUrl, {
    method: 'POST',
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(acampanteData)
  });

  if (!insertRes.ok) {
    const errBody = await insertRes.text();
    logError('SUPABASE', `[${requestId}] Falha ao inserir acampante: HTTP ${insertRes.status}`, errBody);
    return { ok: false, status: insertRes.status, error: errBody };
  }

  const list = await insertRes.json().catch(() => []);
  return { ok: true, data: Array.isArray(list) && list.length ? list[0] : null };
}

export async function validateCupom({ supabaseUrl, authKey, codigo, requestId }) {
  const normCod = String(codigo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normCod) return null;

  // 1. Tenta chamar o RPC 'validar_cupom' se existir no banco
  try {
    const rpcUrl = `${supabaseUrl}/rest/v1/rpc/validar_cupom`;
    const rpcRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: authKey,
        Authorization: `Bearer ${authKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_codigo: normCod })
    });
    if (rpcRes.ok) {
      const data = await rpcRes.json();
      const r = Array.isArray(data) ? data[0] : data;
      if (r && (r.codigo || r.igreja)) {
        return {
          code: r.codigo || normCod,
          church: r.igreja,
          type: r.tipo,
          value: Number(r.valor)
        };
      }
    }
  } catch (eRpc) {
    log('SUPABASE', `[${requestId}] RPC validar_cupom falhou, tentando fallback na tabela cupons:`, eRpc.message);
  }

  // 2. Fallback: consulta direta na tabela 'cupons'
  const searchUrl = `${supabaseUrl}/rest/v1/cupons?codigo=eq.${encodeURIComponent(normCod)}&select=*`;
  const searchRes = await fetch(searchUrl, {
    headers: {
      apikey: authKey,
      Authorization: `Bearer ${authKey}`
    }
  });

  if (!searchRes.ok) {
    logError('SUPABASE', `[${requestId}] Erro ao buscar cupom na tabela cupons: HTTP ${searchRes.status}`, await searchRes.text());
    return null;
  }

  const list = await searchRes.json();
  if (!Array.isArray(list) || !list.length) return null;

  const c = list[0];
  const hoje = new Date().toISOString().slice(0, 10);
  if (c.ativo === false) return { invalid: true, reason: 'Cupom pausado/desativado' };
  if (c.validade && c.validade < hoje) return { invalid: true, reason: 'Cupom expirado' };

  return {
    code: c.codigo,
    church: c.igreja,
    type: c.tipo,
    value: Number(c.valor)
  };
}
