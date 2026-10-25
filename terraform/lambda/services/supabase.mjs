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
