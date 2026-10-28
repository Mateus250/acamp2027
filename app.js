/* ============================================================
   IMERSOS · código da página
   Para trocar datas, local, valores, lotes, WhatsApp, PIX e preletores,
   edite o bloco CONFIG logo abaixo e suba a pasta de novo no Netlify.
   ============================================================ */
/* ===== EDITE AQUI: tudo que muda de um acampamento para outro ===== */
const CONFIG = {
  preview: false,                                  // true = mostra o aviso de prévia; mude para false ao publicar de verdade
  church: 'Igreja Presbiteriana Independente Parque Itajaí',
  churchShort: 'IPI Itajaí',                       // nome curto que aparece no topo da página
  camp: 'Imersos',
  themeRelease: '2026-11-21T20:00:00-03:00', // Liberação do tema oficial: 21 de Novembro de 2026 às 20h
  edition: 'Acampamento de Carnaval 2027',
  dates: '5 a 9 de fevereiro de 2027',
  campStart: '2027-02-05',                         // primeiro dia do acampamento: usado na contagem regressiva e para saber se a pessoa será menor de idade
  place: 'Espaço SET – Indaiatuba',
  departure: 'Saída e chegada: a confirmar com a organização.',
  whatsapp: '',                                    // WhatsApp de dúvidas (rodapé). Só números, com 55 e DDD. Vazio = não mostra
  proofContacts: [                                 // quem recebe os comprovantes: nome que aparece no botão e número (só números, com 55 e DDD)
    { name: '(19) 99209-1360', number: '5519992091360' },
    { name: '(19) 99254-7677', number: '5519992547677' }
  ],
  maxInstallments: 1,
  lots: [ { name: '1º lote promocional', price: 43000, until: '2026-11-30' }, { name: '2º lote', price: 49500, until: '2027-01-20' } ],  // preço em centavos
  bring: 'Roupas leves e de frio, toalha, itens de higiene, Bíblia, caderno, tênis e protetor solar.',
  includes: 'Hospedagem, alimentação, camiseta e todas as atividades.',
  speakersRevealed: false,                         // false = cartões embaçados com aviso "em breve"; mude para true quando os preletores forem definidos
  speakers: [                                      // preletores: troque nome, descrição e foto. photo vazio = arte de demonstração
    { name: 'Preletor a confirmar', role: 'Nome e foto serão divulgados pela organização', photo: '' },
    { name: 'Preletora a confirmar', role: 'Nome e foto serão divulgados pela organização', photo: '' },
    { name: 'Preletor a confirmar', role: 'Nome e foto serão divulgados pela organização', photo: '' },
    { name: 'Louvor a confirmar', role: 'Ministério de louvor do acampamento', photo: '' }
  ],
  // cupons de desconto e links de pagamento no cartão: cadastre no painel /admin, em Ajustes
  emailOn: true,                                  // mude para true quando o e-mail automático estiver ligado no Supabase
  minAge: null                                     // ex.: 13 para exigir idade mínima; null = sem limite
};
/* ================================================================== */
/* banco de dados (Supabase): as inscrições caem direto no painel /admin */
/* Todas as consultas e gravações são realizadas com segurança através da API backend (/api/*) */
const API_BASE = (typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.protocol === "file:"))
  ? "https://acampamentoipi.com.br"
  : "";
let sending = false;
const $ = (s, r) => (r || document).querySelector(s);
const brl = (c) => 'R$ ' + Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + String(c % 100).padStart(2, '0');
const todayBR = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const fmtD = (iso) => iso.slice(8) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

const activeLot = () => { const t = todayBR(); return CONFIG.lots.find((l) => t <= l.until) || CONFIG.lots[CONFIG.lots.length - 1]; };
const lotOpen = () => CONFIG.lots.some((l) => todayBR() <= l.until);

/* conteúdo vindo da configuração */
if (CONFIG.preview) $('#preview').hidden = false;
document.title = 'Acampamento 2027 · ' + CONFIG.edition;
$('#word').textContent = CONFIG.camp.toUpperCase();
$('#kicker').textContent = CONFIG.edition;
$('#lede').textContent = 'Cinco dias para desligar o barulho e ir fundo.';
$('#infolist').innerHTML = [['Quando', CONFIG.dates], ['Onde', CONFIG.place], ['O que levar', CONFIG.bring]].map((r) => '<dt>' + r[0] + '</dt><dd></dd>').join('');
[...document.querySelectorAll('#infolist dd')].forEach((dd, i) => (dd.textContent = [CONFIG.dates, CONFIG.place, CONFIG.bring][i]));
/* o mapinha fica junto do "Onde" */
(() => { const box = $('#mapaBox'), dd = document.querySelectorAll('#infolist dd')[1]; if (box && dd) { dd.appendChild(box); box.classList.remove('hide'); } })();
$('#church').textContent = CONFIG.church; $('#churchtop').textContent = CONFIG.churchShort || CONFIG.church;
if (CONFIG.whatsapp) $('#fwa').href = 'https://wa.me/' + CONFIG.whatsapp; else $('#fwaLine').classList.add('hide');
/* lotes: todos com etiqueta, para os cartões ficarem alinhados */
const dayAfter = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
$('#lots').innerHTML = CONFIG.lots.map((l, i) => {
  const on = l === activeLot() && lotOpen(), past = todayBR() > l.until && !on, prev = CONFIG.lots[i - 1];
  const tg = on ? '<div class="tagnow">Aberto agora</div>' : past ? '<div class="tagnow off">Encerrado</div>' : '<div class="tagnow next">Em breve</div>';
  const sub = on || past ? 'Até ' + fmtD(l.until) : prev ? 'A partir de ' + fmtD(dayAfter(prev.until)) : 'Até ' + fmtD(l.until);
  return '<div class="lot' + (on ? ' on' : '') + '">' + tg + '<div class="nm">' + l.name + '</div><div class="pr">' + brl(l.price) + '</div><div class="sub">' + sub + '</div></div>';
}).join('');
$('#consentTxt').textContent = 'Concordo em enviar meus dados à organização do acampamento apenas para cuidar da minha inscrição e da minha estadia no acampamento. Se tenho menos de 18 anos, meu responsável sabe e concorda.';
const faqs = [['Posso pagar em parcelas?', 'Sim! Pela InfinitePay você pode parcelar no cartão de crédito em até 12 vezes. O pagamento por PIX é à vista com confirmação imediata.'], ['Quando minha vaga está garantida?', 'Assim que o pagamento for aprovado pela InfinitePay. A confirmação da inscrição é automática.'], ['Menor de 18 anos pode ir?', 'Pode. No formulário, preencha o nome e o celular do pai ou da mãe.'], ['E se eu não puder mais ir?', 'Avise a organização pelo WhatsApp o quanto antes. Cada caso é combinado diretamente com a liderança.'], ['Já fiz a inscrição, e agora?', 'Você será direcionado para o pagamento seguro na InfinitePay. Escolha PIX ou cartão para confirmar sua vaga imediatamente. Guarde o seu código de inscrição.']];
$('#faq').innerHTML = faqs.map((q) => '<details><summary></summary><p></p></details>').join('');
[...document.querySelectorAll('#faq details')].forEach((d, i) => { d.querySelector('summary').textContent = faqs[i][0]; d.querySelector('p').textContent = faqs[i][1]; });

/* opções de pagamento */
/* cupons de desconto: o código digitado é comparado com uma "impressão digital", então não dá para ler os cupons no código da página */
let coupon = null;
const normCode = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const applyCoupon = (price, c) => (c.type === 'percent' ? Math.round(price * (100 - c.value) / 100) : c.type === 'off' ? Math.max(0, price - c.value) : c.type === 'price' ? c.value : price);
const finalPrice = () => (coupon ? applyCoupon(activeLot().price, coupon) : activeLot().price);
const couponLabel = (c) => (c.type === 'percent' ? c.value + '% de desconto' : c.type === 'off' ? brl(c.value) + ' de desconto' : 'valor especial de ' + brl(c.value));
const P = [{ id: 'avista', t: 'PIX à vista', first: 0, n: 1 }];   // pagamento é feito no checkout (InfinitePay)
const curPlan = () => ({ ...P[0], first: finalPrice() });
const renderSum = () => { const l = activeLot(), tot = finalPrice(); $('#sum').innerHTML = '<div>Lote: <b>' + l.name + '</b> · Total: ' + (coupon ? '<s>' + brl(l.price) + '</s> ' : '') + '<b>' + brl(tot) + '</b></div>' + (coupon ? '<div>Cupom: <b>' + coupon.church + '</b> (' + couponLabel(coupon) + ')</div>' : ''); };
/* campo do cupom */
(() => {
  const cIn = $('#cupom'), cBtn = $('#cupomBtn'), cMsg = $('#cupomMsg'); if (!cIn) return;
  const say = (t, cls) => { cMsg.textContent = t; cMsg.className = 'cupom-msg' + (cls ? ' ' + cls : ''); };
  const setC = (c) => { coupon = c; renderSum(); };
  cBtn.addEventListener('click', async () => {
    if (coupon) { setC(null); cIn.value = ''; cIn.disabled = false; cBtn.textContent = 'Aplicar'; say(''); cIn.focus(); return; }
    const code = normCode(cIn.value); if (!code) { say('Digite o cupom.', 'bad'); return; }
    cBtn.disabled = true; say('Conferindo…');
    let c = null;
    try {
      const res = await fetch(API_BASE + '/api/cupom?codigo=' + encodeURIComponent(code));
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.cupom) {
          c = data.cupom;
        } else {
          cBtn.disabled = false;
          say(data.error || 'Cupom não encontrado. Confira com a liderança da sua igreja.', 'bad');
          return;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        cBtn.disabled = false;
        say(errJson.error || 'Cupom não encontrado. Confira com a liderança da sua igreja.', 'bad');
        return;
      }
    } catch (e) {
      console.error('Falha ao validar cupom via API:', e);
      cBtn.disabled = false;
      say('Não foi possível conferir o cupom agora. Tente de novo em instantes.', 'bad');
      return;
    }
    cBtn.disabled = false;
    if (!c) { say('Cupom não encontrado. Confira com a liderança da sua igreja.', 'bad'); return; }
    setC(c); cIn.disabled = true; cBtn.textContent = 'Remover'; say('Cupom de ' + c.church + ' aplicado: ' + couponLabel(c) + '.', 'ok');
  });
  cIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); cBtn.click(); } });
})();
renderSum();
const step1 = $('#done .steps > li'), step1Pix = step1 ? step1.innerHTML : '';

/* validação e máscara de CPF */
const validaCPF = (cpf) => {
  const d = String(cpf).replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let soma = 0, resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(d.substring(i - 1, i), 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(d.substring(9, 10), 10)) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(d.substring(i - 1, i), 10) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(d.substring(10, 11), 10)) return false;
  return true;
};
const maskCPF = (v) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
};

/* menor de idade */
const ageAt = (birth, ref) => { const b = new Date(birth + 'T00:00:00'), r = new Date(ref + 'T00:00:00'); let a = r.getFullYear() - b.getFullYear(); if (r < new Date(r.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const f = $('#f');
f.elements.noshirt.addEventListener('change', () => { f.elements.shirt.disabled = f.elements.noshirt.checked; if (f.elements.noshirt.checked) { f.elements.shirt.value = ''; setErr('shirt', ''); } });
const PAIS = ['resp1_name', 'resp1_cpf', 'resp1_phone', 'resp2_name', 'resp2_cpf', 'resp2_phone'];
const syncAdult = () => { const on = f.elements.adult.checked; PAIS.forEach((n) => { if (f.elements[n]) { f.elements[n].disabled = on; if (on) setErr(n, ''); } }); $('#pais').classList.toggle('off', on); };
f.elements.adult.addEventListener('change', syncAdult);
['cpf', 'resp1_cpf', 'resp2_cpf'].forEach((n) => {
  if (f.elements[n]) f.elements[n].addEventListener('input', (e) => { e.target.value = maskCPF(e.target.value); });
});
['phone', 'resp1_phone', 'resp2_phone'].forEach((n) => {
  if (f.elements[n]) f.elements[n].addEventListener('input', (e) => { e.target.value = maskPhone(e.target.value); });
});
if ($('#csDoc')) {
  $('#csDoc').addEventListener('input', (e) => { e.target.value = maskCPF(e.target.value); });
}

f.elements.birth.addEventListener('change', () => { const b = f.elements.birth.value; if (!b) return; const a = ageAt(b, CONFIG.campStart); if (a >= 0 && a <= 110) { f.elements.adult.checked = a >= 18; syncAdult(); } });

/* envio */
const setErr = (k, m) => { const e = $('[data-e=' + k + ']'); if (e) e.textContent = m || ''; const el = f.elements[k]; if (el && el.classList) el.classList.toggle('bad', !!m); };
const digits = (s) => s.replace(/\D/g, '');
f.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  ['name', 'cpf', 'phone', 'email', 'birth', 'shirt', 'resp1_name', 'resp1_cpf', 'resp1_phone', 'resp2_name', 'resp2_cpf', 'resp2_phone', 'termo_financeiro', 'termo_imagem', 'termo_bens', 'consent'].forEach((k) => setErr(k, ''));
  const v = {
    name: f.elements.name.value.trim(),
    cpf: (f.elements.cpf ? f.elements.cpf.value.trim() : ''),
    phone: f.elements.phone.value.trim(),
    email: f.elements.email.value.trim().toLowerCase(),
    birth: f.elements.birth.value,
    shirt: f.elements.shirt.value,
    resp1_name: (f.elements.resp1_name ? f.elements.resp1_name.value.trim() : ''),
    resp1_cpf: (f.elements.resp1_cpf ? f.elements.resp1_cpf.value.trim() : ''),
    resp1_phone: (f.elements.resp1_phone ? f.elements.resp1_phone.value.trim() : ''),
    resp2_name: (f.elements.resp2_name ? f.elements.resp2_name.value.trim() : ''),
    resp2_cpf: (f.elements.resp2_cpf ? f.elements.resp2_cpf.value.trim() : ''),
    resp2_phone: (f.elements.resp2_phone ? f.elements.resp2_phone.value.trim() : '')
  };
  let first = null; const bad = (k, m) => { setErr(k, m); first = first || f.elements[k]; };
  if (v.name.split(/\s+/).filter(Boolean).length < 2) bad('name', 'Digite seu nome completo.');
  if (!validaCPF(v.cpf)) bad('cpf', 'Digite um CPF válido (11 dígitos).');
  const phoneDig = digits(v.phone);
  if (phoneDig.length < 10 || phoneDig.length > 11) bad('phone', 'Digite o WhatsApp com DDD (10 ou 11 dígitos).');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.email)) bad('email', 'Digite um e-mail válido. É para lá que vão a confirmação e o seu código.');
  if (!v.birth) bad('birth', 'Informe a data de nascimento.');
  else {
    const a = ageAt(v.birth, CONFIG.campStart);
    if (a < 0 || a > 110) bad('birth', 'Confira a data de nascimento.');
    else if (CONFIG.minAge && a < CONFIG.minAge) bad('birth', 'O acampamento é para quem tem ' + CONFIG.minAge + ' anos ou mais.');
    else if (a < 18 && f.elements.adult.checked) bad('birth', 'Pela data de nascimento, você terá ' + a + ' anos no acampamento. Desmarque "Sou maior de 18 anos" e preencha os dados dos responsáveis.');
    else if (a < 18) {
      if (v.resp1_name.split(/\s+/).filter(Boolean).length < 2) bad('resp1_name', 'Digite o nome completo do 1º responsável.');
      if (!validaCPF(v.resp1_cpf)) bad('resp1_cpf', 'Digite um CPF válido para o 1º responsável (11 dígitos).');
      const resp1Dig = digits(v.resp1_phone);
      if (resp1Dig.length < 10 || resp1Dig.length > 11) bad('resp1_phone', 'Informe o celular do 1º responsável com DDD (10 ou 11 dígitos).');
      
      if (v.resp2_cpf && !validaCPF(v.resp2_cpf)) bad('resp2_cpf', 'CPF do 2º responsável inválido.');
      const resp2Dig = digits(v.resp2_phone);
      if (v.resp2_phone && (resp2Dig.length < 10 || resp2Dig.length > 11)) bad('resp2_phone', 'Informe o celular do 2º responsável com DDD (10 ou 11 dígitos).');
    }
  }
  if (!v.shirt && !f.elements.noshirt.checked) bad('shirt', 'Escolha o tamanho ou marque que não quer camiseta agora.');
  if (!f.elements.termo_financeiro.checked) bad('termo_financeiro', 'Você precisa concordar com o termo de responsabilidade financeira.');
  if (!f.elements.termo_imagem.checked) bad('termo_imagem', 'Você precisa autorizar o uso de imagem.');
  if (!f.elements.termo_bens.checked) bad('termo_bens', 'Você precisa estar ciente da responsabilidade sobre bens pessoais.');
  if (!f.elements.consent.checked) bad('consent', 'Marque a caixa para continuar.');
  if (first) { first.focus(); return; }
  const p = curPlan(), l = activeLot();
  const code = 'IMR-' + (Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4)).toUpperCase();
  const minor = ageAt(v.birth, CONFIG.campStart) < 18;
  const msg = [
    'Olá! Quero me inscrever no ' + CONFIG.edition + '.',
    '',
    'Código: ' + code,
    'Nome: ' + v.name,
    'CPF: ' + maskCPF(v.cpf),
    'WhatsApp: ' + v.phone,
    'Nascimento: ' + fmtD(v.birth),
    minor && v.resp1_name ? '1º Resp: ' + v.resp1_name + ' (CPF: ' + maskCPF(v.resp1_cpf) + ', Tel: ' + v.resp1_phone + ')' : null,
    minor && v.resp2_name ? '2º Resp: ' + v.resp2_name + (v.resp2_cpf ? ' (CPF: ' + maskCPF(v.resp2_cpf) + ')' : '') + (v.resp2_phone ? ' (Tel: ' + v.resp2_phone + ')' : '') : null,
    'Camiseta: ' + (f.elements.noshirt.checked ? 'não quero agora (decido depois, pessoalmente)' : v.shirt),
    'Lote: ' + l.name + ' · Total ' + brl(finalPrice()) + (coupon ? ' (cupom ' + (coupon.code ? coupon.code + ' ' : '') + coupon.church + ')' : ''),
    'Pagamento: ' + p.t + ' · hoje ' + brl(p.first)
  ].filter((x) => x !== null).join('\n');

  /* grava a inscrição no banco antes de mostrar o PIX */
  if (sending) return;
  const cpfDig = digits(v.cpf);
  const btn = $('#submit'), oldTxt = btn.textContent;
  let errBox = $('#sendErr');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'sendErr';
    errBox.className = 'err';
    errBox.setAttribute('role', 'alert');
    errBox.style.marginTop = '14px';
    btn.insertAdjacentElement('afterend', errBox);
  }
  errBox.textContent = '';

  /* Verifica se já existe alguém com esse documento (CPF) cadastrado via API */
  if (cpfDig) {
    sending = true;
    btn.disabled = true;
    btn.textContent = 'Verificando inscrição anterior…';
    try {
      const chkRes = await fetch(API_BASE + '/api/verificar-cpf?cpf=' + encodeURIComponent(cpfDig));
      if (chkRes.ok) {
        const chkData = await chkRes.json();
        if (chkData && chkData.exists && chkData.jaInscrito) {
          sending = false;
          btn.disabled = false;
          btn.textContent = oldTxt;
          const ja = chkData.jaInscrito;
          errBox.innerHTML = 'Já existe uma inscrição com este CPF (<b>' + esc(ja.nome) + '</b> - Código: <b>' + esc(ja.codigo) + '</b>). Redirecionando para a consulta...';
          if ($('#csDoc')) $('#csDoc').value = maskCPF(v.cpf);
          setTimeout(() => {
            const csSec = $('#consulta');
            if (csSec) csSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            const csBtn = $('#csBtn');
            if (csBtn) csBtn.click();
          }, 1200);
          return;
        }
      }
    } catch (eDup) {
      console.warn('Aviso ao conferir duplicidade via API:', eDup);
    }
    sending = false;
    btn.disabled = false;
    btn.textContent = oldTxt;
  }
  const total = finalPrice(), hoje = todayBR(), base = Math.floor(total / p.n);
  const addMonths = (iso, k) => { const [y, m, dd] = iso.split('-').map(Number); const t = new Date(y, m - 1 + k, 1); t.setDate(Math.min(dd, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate())); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const parcelas = []; for (let i = 0; i < p.n; i++) parcelas.push({ n: i + 1, valor: i === 0 ? p.first : base, venc: addMonths(hoje, i), pago: 0, dataPag: '' });
  const resp = minor ? [
    v.resp1_name ? '1º Resp: ' + v.resp1_name + (v.resp1_cpf ? ' (CPF: ' + maskCPF(v.resp1_cpf) + ')' : '') : '',
    v.resp2_name ? '2º Resp: ' + v.resp2_name + (v.resp2_cpf ? ' (CPF: ' + maskCPF(v.resp2_cpf) + ')' : '') : ''
  ].filter(Boolean).join(' / ') : '';
  const respTel = minor ? [v.resp1_phone, v.resp2_phone].filter(Boolean).join(' / ') : '';
  const obs = [
    'CPF: ' + cpfDig,
    minor && v.resp1_cpf ? 'Resp1 CPF: ' + digits(v.resp1_cpf) : '',
    minor && v.resp2_cpf ? 'Resp2 CPF: ' + digits(v.resp2_cpf) : '',
    coupon ? 'Cupom: ' + (coupon.code ? coupon.code + ' · ' : '') + coupon.church + ' (' + couponLabel(coupon) + ')' : '',
    'Termos aceitos: Financeiro (30 dias), Imagem, Bens'
  ].filter(Boolean).join(' · ');
  const row = { codigo: code, nome: v.name, telefone: v.phone, email: v.email, nascimento: v.birth, idade: ageAt(v.birth, CONFIG.campStart), camiseta: f.elements.noshirt.checked ? 'Não quer agora' : v.shirt, responsavel: resp || null, responsavel_tel: respTel || null, obs: obs || null, lote: l.name, opcao_id: p.id, opcao_nome: p.t, parcelas, origem: 'site' };
  sending = true; btn.disabled = true; btn.textContent = 'Enviando…';
  errBox.textContent = '';
  let salvo = false;
  try {
    const saveRes = await fetch(API_BASE + '/api/inscricoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    if (saveRes.ok) {
      const saveData = await saveRes.json();
      if (saveData && saveData.ok) {
        salvo = true;
      }
    } else if (saveRes.status === 409) {
      const conflictData = await saveRes.json();
      sending = false; btn.disabled = false; btn.textContent = oldTxt;
      errBox.innerHTML = esc(conflictData.error || 'Já existe uma inscrição com este CPF.');
      return;
    }
  } catch (e) {
    console.error('Falha ao enviar inscrição para API:', e);
  }
  sending = false; btn.disabled = false; btn.textContent = oldTxt;
  if (!salvo) {
    errBox.innerHTML = 'Não conseguimos registrar sua inscrição agora. Confira sua internet e toque em <b>Enviar inscrição</b> de novo. Se continuar, <a target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline">mande sua inscrição pelo WhatsApp</a>.';
    errBox.querySelector('a').href = 'https://wa.me/' + (CONFIG.whatsapp || CONFIG.proofContacts[0].number) + '?text=' + encodeURIComponent(msg);
    return;
  }
  $('#code').textContent = code;
  const checkoutUrl = 'checkout.html?codigo=' + encodeURIComponent(code) + '&valor=' + encodeURIComponent(p.first) + '&cpf=' + encodeURIComponent(cpfDig);
  const btnGo = $('#btnGoCheckout');
  if (btnGo) btnGo.href = checkoutUrl;
  if ($('#csDoc')) $('#csDoc').value = maskCPF(v.cpf);

  btn.disabled = true;
  btn.textContent = 'Inscrição realizada! Abrindo checkout…';
  window.location.href = checkoutUrl;
  // Atualiza código de consulta e notas
  if ($('#csCode')) $('#csCode').value = code;
  if ($('#csTel')) $('#csTel').value = v.phone;
  if ($('#emailNote')) $('#emailNote').textContent = CONFIG.emailOn ? 'Também enviamos o código para ' + v.email + ' (confira a caixa de spam).' : '';

  f.classList.add('hide');
  const d = $('#done');
  if (d) {
    d.classList.remove('hide');
    d.focus();
    d.scrollIntoView({ block: 'start' });
    setTimeout(() => { if (window.__burst) window.__burst(innerWidth / 2, Math.min(innerHeight * 0.65, innerHeight / 2 + 60)); }, 450);
  }
});

/* profundímetro e barra fixa */
const gdot = $('#gdot'), gnum = $('#gnum'), bar = $('#bar');
const onScroll = () => { const h = document.documentElement.scrollHeight - innerHeight; const pr = h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0; gdot.style.top = 'calc(' + (pr * 100) + '% - 20px)'; const dY = scrollY - (onScroll.last || 0); if (dY > 2) gdot.classList.remove('up'); else if (dY < -2) gdot.classList.add('up'); onScroll.last = scrollY; document.body.classList.toggle('scrolled', scrollY > 40); gnum.firstChild.nodeValue = Math.round(pr * 30) + ' m'; const ins = $('#inscricao').getBoundingClientRect(); bar.classList.toggle('show', scrollY > innerHeight * 0.6 && !(ins.top < innerHeight * 0.7 && ins.bottom > 0)); };
addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();

/* ===== CONTAGEM E COMPARTILHAR ===== */
(() => {
  /* contagem regressiva */
  const target = new Date(CONFIG.campStart + 'T00:00:00-03:00').getTime();
  const els = { D: $('#cdD'), H: $('#cdH'), M: $('#cdM'), S: $('#cdS') }; const prev = {};
  const put = (k, v) => { if (prev[k] === v) return; prev[k] = v; const e = els[k]; e.textContent = v; e.classList.remove('tk'); void e.offsetWidth; e.classList.add('tk'); };
  const tick = () => { const diff = target - Date.now(); if (isNaN(target)) { $('#countwrap').classList.add('hide'); return false; } if (diff <= 0) { $('#count').classList.add('hide'); $('#cdcap').textContent = 'O acampamento já começou!'; return false; } const s = Math.floor(diff / 1000); put('D', String(Math.floor(s / 86400))); put('H', String(Math.floor(s % 86400 / 3600)).padStart(2, '0')); put('M', String(Math.floor(s % 3600 / 60)).padStart(2, '0')); put('S', String(s % 60).padStart(2, '0')); return true; };
  if (tick()) { const iv = setInterval(() => { if (!tick()) clearInterval(iv); }, 1000); }

  /* chamar um amigo */
  const text = 'Bora mergulhar no ' + CONFIG.edition + '? Inscrições aqui:';
  const url = () => location.href.split('#')[0];
  document.querySelectorAll('.shareBtn').forEach((a) => {
    a.href = 'https://wa.me/?text=' + encodeURIComponent(text + ' ' + url());
    a.addEventListener('click', async (e) => { if (!navigator.share) return; e.preventDefault(); try { await navigator.share({ title: CONFIG.edition, text, url: url() }); } catch (x) { /* a pessoa fechou o menu */ } });
  });
})();

/* ===== CONHEÇA O LUGAR: fotos passando sozinhas ===== */
(() => {
  const view = $('#lgView'), belt = $('#lgBelt'); if (!view) return;
  const originals = [...belt.children];
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* tela cheia */
  const lb = $('#lb'), lbImg = $('#lbImg'), lbCap = $('#lbCap'); let cur = 0, paused = false, lastFocus = null;
  const show = (i) => { cur = (i + originals.length) % originals.length; const im = originals[cur].querySelector('img'); lbImg.src = im.src; lbImg.alt = im.alt; lbCap.textContent = ''; };
  const openLb = (i) => { lastFocus = document.activeElement; show(i); lb.classList.remove('hide'); document.body.style.overflow = 'hidden'; paused = true; lb.querySelector('.lb-x').focus(); };
  const closeLb = () => { lb.classList.add('hide'); document.body.style.overflow = ''; paused = false; if (lastFocus) lastFocus.focus(); };
  lb.querySelector('.lb-x').addEventListener('click', closeLb);
  lb.querySelector('.lb-p').addEventListener('click', () => show(cur - 1));
  lb.querySelector('.lb-n').addEventListener('click', () => show(cur + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) closeLb(); });
  addEventListener('keydown', (e) => { if (lb.classList.contains('hide')) return; if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });
  let moved = 0;
  belt.addEventListener('click', (e) => { const b = e.target.closest('.lg-open'); if (!b) return; if (moved > 8) { moved = 0; return; } openLb(Number(b.dataset.i)); });
  if (reduce) { view.classList.add('static'); return; }
  /* repete as fotos até cobrir bem a tela, para o giro não ter emenda */
  const addCopy = () => originals.forEach((o) => { const c = o.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.querySelector('button').tabIndex = -1; belt.appendChild(c); });
  addCopy(); while (belt.scrollWidth < innerWidth * 2.2 && belt.children.length < originals.length * 8) addCopy();
  let off = 0, half = 0, visible = false, raf = 0, last = 0, hover = false, dragging = false, sx = 0, so = 0, touchPause = 0;
  const per = () => { let w = 0; const gap = parseFloat(getComputedStyle(belt).columnGap) || 16; for (let k = 0; k < originals.length; k++) w += belt.children[k].getBoundingClientRect().width + gap; return w; };
  const measure = () => { half = per(); };
  const speed = () => (innerWidth < 760 ? 26 : 34);
  const tick = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!paused && !hover && !dragging && t > touchPause) off += speed() * dt;
    if (half > 0) off = ((off % half) + half) % half;
    belt.style.transform = 'translate3d(' + (-off).toFixed(1) + 'px,0,0)';
    raf = visible ? requestAnimationFrame(tick) : 0;
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) { belt.querySelectorAll('img[loading="lazy"]').forEach((im) => { im.loading = 'eager'; }); measure(); start(); } }, { rootMargin: '300px 0px' }).observe(view);
  else { visible = true; start(); }
  addEventListener('resize', measure); belt.querySelectorAll('img').forEach((im) => { if (!im.complete) im.addEventListener('load', measure, { once: true }); });
  measure();
  view.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hover = true; });
  view.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hover = false; });
  view.addEventListener('pointerdown', (e) => { dragging = true; sx = e.clientX; so = off; moved = 0; view.classList.add('drag'); });
  addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); off = so - dx; }, { passive: true });
  const end = (e) => { if (!dragging) return; dragging = false; view.classList.remove('drag'); if (e.pointerType !== 'mouse') touchPause = performance.now() + 2500; };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
})();

/* ===== PRELETORES EM SUSPENSE: mergulhador com lanterna =====
   Some sozinho quando speakersRevealed = true. */
function lanterna(track) {
  const cards = [...track.querySelectorAll('.sp-card.sealed')]; if (!cards.length) return;
  cards.forEach((c) => {
    const lit = document.createElement('div'); lit.className = 'sp-lit';
    c.querySelectorAll('.sp-art, .sp-sil').forEach((el) => lit.appendChild(el.cloneNode(true)));
    const dk = document.createElement('div'); dk.className = 'sp-dark';
    c.append(lit, dk);
  });
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fx = document.createElement('div'); fx.className = 'sp-fx'; fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = '<svg class="sp-cone" width="100%" height="100%" style="position:absolute;inset:0;overflow:visible"><defs><linearGradient id="spLg" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffeab8" stop-opacity=".4"/><stop offset="1" stop-color="#ffeab8" stop-opacity="0"/></linearGradient></defs><polygon fill="url(#spLg)"/></svg>'
    + '<svg class="sp-diver" viewBox="0 0 84 40"><path class="kf" d="M10 17 L0 10 L2 18 Z" fill="#E8A93C" style="transform-origin:10px 17px"/><path class="kf b" d="M10 23 L0 30 L2 22 Z" fill="#E8A93C" style="transform-origin:10px 23px"/><rect x="9" y="15" width="22" height="5" rx="2.5" fill="#FFD27A"/><rect x="9" y="20" width="22" height="5" rx="2.5" fill="#f0c25f"/><rect x="28" y="12" width="30" height="16" rx="8" fill="#FFD27A"/><rect x="30" y="6" width="22" height="7" rx="3.5" fill="#E6F6F3"/><rect x="34" y="6" width="3" height="7" fill="#1B8396"/><circle cx="63" cy="18" r="7.5" fill="#FFD27A"/><rect x="63" y="13" width="9" height="7" rx="3" fill="#1B8396"/><rect x="64.5" y="14.5" width="5" height="3" rx="1.5" fill="#8fe3d4"/><path d="M50 24 L70 28" stroke="#f0c25f" stroke-width="4" stroke-linecap="round"/><rect x="69" y="25.5" width="9" height="5" rx="1.5" fill="#E6F6F3"/><rect x="77" y="25" width="2.5" height="6" rx="1" fill="#fff6d8"/></svg>';
  track.appendChild(fx);
  const poly = fx.querySelector('polygon'), lg = fx.querySelector('#spLg'), dv = fx.querySelector('.sp-diver');
  /* SEGUE_MOUSE: no computador o mergulhador vai atrás do mouse; no celular ele nada sempre sozinho, sem seguir o dedo.
     Para deixar sozinho também no computador, troque para false. */
  const SEGUE_MOUSE = true;
  let touch = 0, tx = 0, ty = 0, last = 0, px = -1, py = -1, vxs = 0, vys = 0, wx = -1, wy = -1, wUntil = 0, svx = 0, dir = 1, face = 1, ang = 0, on = true, raf = 0;
  const pos = (e) => { if (e.pointerType !== 'mouse') return; const r = track.getBoundingClientRect(); tx = e.clientX - r.left; ty = e.clientY - r.top; touch = 1; last = performance.now(); };
  if (SEGUE_MOUSE) track.addEventListener('pointermove', pos);
  const frame = (t) => {
    raf = 0; if (!on) return;
    const r = track.getBoundingClientRect(), W = r.width, H = r.height, s = t / 1000, mob = W < 560;
    if (touch && t - last > 2000) touch = 0;
    const c0 = cards[0].getBoundingClientRect(), cN = cards[cards.length - 1].getBoundingClientRect();
    const L = c0.left - r.left, T = c0.top - r.top, R = cN.right - r.left, B = cN.bottom - r.top, CW = R - L, CH = B - T;
    if (px < 0) { px = L + CW * .5; py = T + CH * .45; }
    let gx, gy;
    if (touch) { gx = tx; gy = ty; }
    else {
      /* passeio aleatório: escolhe um ponto qualquer dentro dos cards, nada até lá, às vezes para um pouquinho e escolhe outro */
      if (wx < 0 || t > wUntil || Math.hypot(wx - px, wy - py) < 18) {
        const ladoOposto = px < L + CW / 2 ? .55 + Math.random() * .45 : Math.random() * .45;
        wx = L + CW * (Math.random() < .7 ? ladoOposto : Math.random()); wy = T + CH * (.15 + Math.random() * .7);
        wUntil = t + 6000 + Math.random() * 4000;
      }
      gx = wx; gy = wy;
    }
    const k = Math.max(.65, Math.min(1.15, CW / 700)), mx = 56 * k, my = 40 * k + 6;
    gx = Math.max(L + mx, Math.min(R - mx, gx)); gy = Math.max(T + Math.max(my, CH * .12), Math.min(B - my, gy));
    fx.style.clipPath = 'inset(' + T.toFixed(1) + 'px ' + (W - R).toFixed(1) + 'px ' + (H - B).toFixed(1) + 'px ' + L.toFixed(1) + 'px round 24px)';
    if (!touch) { wx = gx; wy = gy; }
    const ddx = gx - px, ddy = gy - py, dd = Math.hypot(ddx, ddy) || 1, vmax = (touch ? 6 : 1.5) * k, vel = Math.min(vmax, dd * .045);
    vxs += (ddx / dd * vel - vxs) * .06; vys += (ddy / dd * vel - vys) * .06;
    const vx = vxs, vy = vys; px += vx; py += vy;
    px = Math.max(L + mx, Math.min(R - mx, px)); py = Math.max(T + Math.max(my, CH * .12), Math.min(B - my, py));
    svx = svx * .92 + vx * .08; if (svx > .35) dir = 1; else if (svx < -.35) dir = -1;
    face += (dir - face) * .09; ang += (Math.max(-.45, Math.min(.45, vy * .07)) - ang) * .08;
    const bob = 3 * Math.sin(s * 2.2), sc = Math.max(.65, Math.min(1.15, CW / 700));
    const fs = Math.abs(face) < .12 ? (face < 0 ? -.12 : .12) : face;
    dv.style.transform = 'translate(' + (px - 42).toFixed(1) + 'px,' + (py - 20 + bob).toFixed(1) + 'px) scale(' + (fs * sc).toFixed(3) + ',' + sc.toFixed(3) + ') rotate(' + (Math.sign(fs) * ang).toFixed(3) + 'rad)';
    const lampX = px + face * 36 * sc, lampY = py + bob + 8 * sc, dist = (mob ? CW * .32 : CW * .15) * Math.abs(face);
    const lx = lampX + face * dist * Math.cos(ang), ly = lampY + dist * Math.sin(Math.abs(ang)) * Math.sign(ang) + CH * .05 * Math.abs(face);
    const spread = (mob ? CH * .16 : CH * .34) * Math.abs(face); let nx = -(ly - lampY), ny = lx - lampX; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    poly.setAttribute('points', lampX + ',' + lampY + ' ' + (lx + nx * spread) + ',' + (ly + ny * spread) + ' ' + (lx - nx * spread) + ',' + (ly - ny * spread));
    lg.setAttribute('x1', lampX); lg.setAttribute('y1', lampY); lg.setAttribute('x2', lx); lg.setAttribute('y2', ly);
    const rw = mob ? 80 : CW * .18, rh = mob ? 80 : CH * .5;
    cards.forEach((c) => { const q = c.getBoundingClientRect(); c.style.setProperty('--lx', (lx - (q.left - r.left)).toFixed(1) + 'px'); c.style.setProperty('--ly', (ly - (q.top - r.top)).toFixed(1) + 'px'); c.style.setProperty('--rw', rw + 'px'); c.style.setProperty('--rh', rh + 'px'); });
    raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver((es) => { on = es[0].isIntersecting; if (on && !raf) raf = requestAnimationFrame(frame); });
  io.observe(track);
}

/* ===== PRELETORES ===== */
(() => {
  const track = $('#spTrack'), prev = $('#spPrev'), next = $('#spNext');
  const wavesD = 'M0 20 C 120 4, 240 36, 360 20 S 600 4, 720 20 S 960 36, 1080 20 S 1320 4, 1440 20';
  const art = () => { let lines = ''; for (let k = 0; k < 9; k++) lines += '<path d="' + wavesD + '" transform="translate(0 ' + (k * 26) + ')" stroke="rgba(230,246,243,.22)" stroke-width="1" fill="none"/>'; return '<div class="sp-art" aria-hidden="true"><div class="glow"></div><svg viewBox="0 0 1440 240" preserveAspectRatio="none">' + lines + '</svg></div>'; };
  CONFIG.speakers.forEach((sp, i) => {
    const c = document.createElement('article'); c.className = 'sp-card'; c.setAttribute('role', 'listitem'); c.style.setProperty('--d', i);
    if (!CONFIG.speakersRevealed) { c.classList.add('sealed'); c.setAttribute('aria-hidden', 'true'); c.insertAdjacentHTML('beforeend', art() + '<svg class="sp-sil" viewBox="0 0 100 130" aria-hidden="true"><circle cx="50" cy="46" r="21"/><path d="M8 130 C 8 92 28 78 50 78 S 92 92 92 130 Z"/></svg><div class="sp-info"><h3>Preletor</h3><p>Nome a ser revelado</p></div>'); track.appendChild(c); return; }
    if (sp.photo) { const im = document.createElement('img'); im.src = sp.photo; im.alt = 'Foto de ' + sp.name; im.loading = 'lazy'; c.appendChild(im); }
    else { c.insertAdjacentHTML('beforeend', art()); const b = document.createElement('span'); b.className = 'sp-badge'; b.textContent = 'conteúdo de demonstração'; c.appendChild(b); }
    const info = document.createElement('div'); info.className = 'sp-info'; const h = document.createElement('h3'); h.textContent = sp.name; const p = document.createElement('p'); p.textContent = sp.role || ''; info.append(h, p); c.appendChild(info);
    track.appendChild(c);
  });
  if (!CONFIG.speakersRevealed) {
    track.classList.add('is-sealed'); track.removeAttribute('tabindex'); [prev, next].forEach((b) => { if (b) b.hidden = true; });
    const sub = $('#preletores .sp-sub'); if (sub) sub.innerHTML = '<span class="sp-soon"><span>Preletores revelados em breve</span><b>Fique de olho</b></span>';
    lanterna(track);
  }
  /* alinha o primeiro cartão com o texto da página */
  const align = () => { const wl = Math.round($('#preletores .wrap').getBoundingClientRect().left); track.style.paddingLeft = wl + 'px'; track.style.scrollPaddingLeft = wl + 'px'; };
  const step = () => { const c = track.querySelector('.sp-card'); return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 18) : 300; };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const upd = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft >= max;
    if (reduce) return;
    const tl = track.getBoundingClientRect().left + parseFloat(track.style.paddingLeft || 0);
    track.querySelectorAll('.sp-card').forEach((c) => { const r = c.getBoundingClientRect(); const off = (r.left - tl) / r.width; const k = Math.max(-1, Math.min(0, off)); c.style.transform = 'scale(' + (1 + k * 0.08).toFixed(3) + ')'; c.style.opacity = (1 + k * 0.55).toFixed(3); });
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: reduce ? 'auto' : 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: reduce ? 'auto' : 'smooth' }));
  track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); } if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); } });
  let pend = false; track.addEventListener('scroll', () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; upd(); }); }, { passive: true });
  addEventListener('resize', () => { align(); upd(); }); align(); upd();
})();

/* ===== CONSULTE SUA INSCRIÇÃO ===== */
(() => {
  const form = $('#csForm'); if (!form) return;
  const msg = $('#csMsg'), res = $('#csRes'), btn = $('#csBtn');
  const say = (t, bad) => { msg.textContent = t; msg.className = 'cs-msg' + (bad ? ' bad' : ''); };
  const ROT = { pago: 'Pago', parcial: 'Parcialmente pago', pendente: 'Pagamento pendente', atrasado: 'Parcela atrasada' };
  const stParc = (p) => (p.valor > 0 && p.pago >= p.valor ? 'pago' : p.venc && p.venc < todayBR() ? 'atrasado' : p.pago > 0 ? 'parcial' : 'pendente');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Chegou pelo link: ?consulta=... ou ?cpf=... */
  const q = new URLSearchParams(location.search).get('consulta') || new URLSearchParams(location.search).get('cpf');
  if (q && $('#csDoc')) {
    const qDig = digits(q);
    $('#csDoc').value = qDig.length === 11 ? maskCPF(qDig) : q;
    setTimeout(() => {
      $('#consulta').scrollIntoView({ block: 'start' });
      if (qDig.length === 11) btn.click();
      else $('#csDoc').focus();
    }, 600);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const docInput = $('#csDoc');
    const doc = docInput ? docInput.value.trim() : '';
    res.classList.add('hide');
    const cpfNum = digits(doc);
    if (cpfNum.length !== 11) {
      return say('Digite o CPF completo do acampante (11 dígitos).', true);
    }
    if (!validaCPF(cpfNum)) {
      return say('Digite um CPF válido para consultar.', true);
    }

    btn.disabled = true; say('Consultando sua inscrição…');
    let r = null;
    try {
      // 1. Consulta prioritariamente na API segura /api/status (com service_role e checagem em tempo real na InfinitePay)
      try {
        const apiRes = await fetch(API_BASE + '/api/status?cpf=' + encodeURIComponent(cpfNum));
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && !apiData.not_found && apiData.codigo) {
            r = apiData;
          }
        }
      } catch (apiErr) {
        console.warn('Consulta na API de status:', apiErr);
      }

      } catch (err) {
      console.error(err);
      btn.disabled = false;
      return say('Não foi possível consultar agora. Tente de novo em instantes.', true);
    }
    btn.disabled = false;
    if (!r) {
      return say('Não encontramos nenhuma inscrição com o CPF ' + maskCPF(cpfNum) + '. Confira os números ou faça sua inscrição acima.', true);
    }

    const parc = (r.parcelas || []).map((p) => ({ n: p.n, valor: Number(p.valor) || 0, pago: Number(p.pago) || 0, venc: p.venc || '' }));
    const total = parc.reduce((t, p) => t + p.valor, 0), pago = parc.reduce((t, p) => t + Math.min(p.pago, p.valor), 0);
    const st = total > 0 && pago >= total ? 'pago' : parc.some((p) => stParc(p) === 'atrasado') ? 'atrasado' : pago > 0 ? 'parcial' : 'pendente';
    say('');
    const csCpf = cpfNum;
    const isMinor = (r.idade != null && Number(r.idade) > 0 && Number(r.idade) < 18) ||
      (r.nascimento && (new Date('2027-02-05').getFullYear() - new Date(r.nascimento).getFullYear() < 18)) ||
      (r.responsavel && r.responsavel.trim().length > 1) ||
      /Resp1|Resp2|Respons/i.test(r.obs || '');
    const qrCheckinUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(r.codigo || '');

    res.innerHTML = '<div class="cs-head"><b>Oi, ' + esc(r.nome) + '!</b><span class="cs-st ' + st + '">' + ROT[st] + '</span></div>' +
      '<div>' + esc(r.lote || '') + (r.opcao_nome ? ' · ' + esc(r.opcao_nome) : '') + (r.codigo ? ' · Código: <b>' + esc(r.codigo) + '</b>' : '') + '</div>' +
      '<div class="cs-bar" role="img" aria-label="Pago ' + brl(pago) + ' de ' + brl(total) + '"><i style="width:' + (total ? Math.round(pago / total * 100) : 0) + '%"></i></div>' +
      '<div><b>' + brl(pago) + '</b> pagos de <b>' + brl(total) + '</b>' + (total > pago ? ' · falta ' + brl(total - pago) : '') + '</div>' +
      (parc.length > 1 ? '<ul class="cs-parc">' + parc.map((p) => { const s = stParc(p); return '<li><span>Parcela ' + p.n + ' · ' + brl(p.valor) + (p.venc ? ' · vence ' + fmtD(p.venc) : '') + '</span><span class="cs-st ' + s + '">' + (s === 'pago' ? 'Paga' : s === 'atrasado' ? 'Atrasada' : s === 'parcial' ? 'Parcial' : 'Em aberto') + '</span></li>'; }).join('') + '</ul>' : '') +
      (st !== 'pago' ?
        '<p style="margin:14px 0 0;font-size:.92rem">Já pagou e ainda aparece pendente? O processamento pela InfinitePay costuma levar poucos instantes.</p><div style="margin-top:14px"><a href="checkout.html?codigo=' + encodeURIComponent(r.codigo || '') + '&valor=' + encodeURIComponent(total > pago ? (total - pago) : total) + (csCpf ? '&cpf=' + encodeURIComponent(csCpf) : '') + '" class="btn" style="background:#00D09C;color:#03211A;font-weight:700;font-size:0.95rem;padding:0.6em 1.2em;text-decoration:none;display:inline-flex;border-radius:8px">💳 Pagar com InfinitePay (Cartão / Pix)</a></div>' :
        '<div style="margin-top:18px;background:rgba(22,112,124,0.08);border:2px dashed #16707C;border-radius:14px;padding:18px;text-align:center">' +
          '<div style="font-weight:700;font-size:0.85rem;letter-spacing:0.04em;text-transform:uppercase;color:#16707C">Seu Ingresso de Check-in</div>' +
          '<div style="margin:12px auto;width:180px;height:180px;background:#FFFFFF;padding:8px;border-radius:10px;border:1px solid #D0DFDB;box-shadow:0 4px 12px rgba(0,0,0,0.05)">' +
            '<img src="' + qrCheckinUrl + '" alt="QR Code de Check-in" style="width:100%;height:100%;display:block">' +
          '</div>' +
          '<div style="font-family:monospace;font-size:1.3rem;font-weight:800;letter-spacing:0.06em;color:#16707C">' + esc(r.codigo || '') + '</div>' +
          '<p style="margin:8px 0 0;font-size:0.86rem;color:#566C72">Apresente este QR Code no momento do check-in na saída do ônibus ou na entrada do acampamento.</p>' +
          (isMinor ?
            '<div style="margin-top:14px;background:#FDF2E9;border-left:4px solid #E06D53;padding:12px 14px;border-radius:6px;text-align:left;font-size:0.86rem;color:#2D3748">' +
              '<b style="color:#C0442D;display:block;margin-bottom:4px">⚠️ ATENÇÃO: PARTICIPANTE MENOR DE IDADE</b>' +
              'Identificamos que você terá menos de 18 anos. Lembre-se de levar o <b>Termo de Autorização assinado pelos pais ou responsáveis legais</b> para apresentar no check-in. Sem a autorização assinada, o embarque não poderá ser liberado!' +
            '</div>' : '') +
        '</div>' +
        '<p style="margin:14px 0 0;font-size:.92rem">Tudo certo. Nos vemos lá no fundo!</p>');
    res.classList.remove('hide');
  });
})();

/* ===== MOVIMENTO ===== */
(() => {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = $('#word');
  /* título em letras, para cada uma poder balançar */
  const txt = CONFIG.camp.toUpperCase(); w.setAttribute('aria-label', 'Tema em breve'); w.textContent = '';
  const letters = [...txt].map((c, i) => { const o = document.createElement('span'); o.className = 'ch'; o.setAttribute('aria-hidden', 'true'); o.style.setProperty('--i', i); const n = document.createElement('i'); n.textContent = c; o.appendChild(n); w.appendChild(o); return { el: o, py: 0, tg: 0 }; });
  if (reduce) return;
  document.documentElement.classList.add('js');

  /* faixa em movimento */
  const belt = $('#belt'), items = ['TEMA EM BREVE', 'Mergulhe fundo', CONFIG.dates.toUpperCase(), 'Vem pro Acampamento'];
  const seq = () => { for (let r = 0; r < 3; r++) items.forEach((t) => { const sp = document.createElement('span'); sp.textContent = t + ' ≈'; belt.appendChild(sp); }); };
  seq(); [...belt.children].forEach((c) => belt.appendChild(c.cloneNode(true)));
  const beltAnim = belt.getAnimations ? belt.getAnimations()[0] : null;

  /* revelações ao rolar */
  document.querySelectorAll('main h2').forEach((h) => { const t = h.textContent; h.setAttribute('aria-label', t); h.textContent = ''; t.split(' ').forEach((wd, i) => { const s = document.createElement('span'); s.className = 'wd'; s.setAttribute('aria-hidden', 'true'); const u = document.createElement('span'); u.textContent = wd; u.style.setProperty('--k', i); s.appendChild(u); h.appendChild(s); h.appendChild(document.createTextNode(' ')); }); h.classList.add('rv-h'); });
  const mark = (sel, step) => document.querySelectorAll(sel).forEach((el, i) => { el.classList.add('rv'); el.style.setProperty('--d', step ? i : 0); });
  mark('#tema p', true); mark('.dive li', true); mark('#infolist dt, #infolist dd', true); mark('.lot', true); mark('.formcard'); mark('details', true); mark('#spTrack'); mark('#lgView');
  const count = (el) => { const target = parseInt(el.textContent, 10) || 0; const t0 = performance.now(); const tick = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3))) + ' m'; if (k < 1) requestAnimationFrame(tick); }; el.textContent = '0 m'; requestAnimationFrame(tick); };
  const watch = [...document.querySelectorAll('.rv, .rv-h, .depth')];
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; e.target.classList.add('in'); if (e.target.classList.contains('depth')) count(e.target); io.unobserve(e.target); }), { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    watch.forEach((el) => io.observe(el));
  } else watch.forEach((el) => el.classList.add('in'));

  /* letras reagem ao dedo ou ao mouse */
  let px = -9999, py = -9999;
  addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; }, { passive: true });
  addEventListener('pointerleave', () => { px = py = -9999; });

  /* bolhas e "neve marinha": sobem mais rápido quando você rola para baixo */
  const cv = $('#fx'), cx = cv.getContext ? cv.getContext('2d') : null;
  let W = 0, H = 0, dpr = 1; const N = innerWidth < 760 ? 14 : 30; const P = [];
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; if (cx) cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  for (let i = 0; i < N; i++) { const snow = Math.random() < 0.38; P.push({ x: Math.random() * W, y: Math.random() * H, r: snow ? 0.8 + Math.random() * 1.6 : 2 + Math.random() * 7, v: snow ? 6 + Math.random() * 10 : 14 + Math.random() * 34, ph: Math.random() * 6.28, snow }); }
  const drops = [], rings = []; let tilt = 0;
  const pop = (p) => { for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, sp = 40 + Math.random() * 80; drops.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 1 + Math.random() * 2, a: 1 }); } p.y = H + 20; p.x = Math.random() * W; if (navigator.vibrate) { try { navigator.vibrate(8); } catch (x) { /* sem vibração */ } } };
  addEventListener('pointerdown', (e) => { if (e.target.closest && e.target.closest('a,button,input,select,textarea,label,summary,.opt,.formcard')) return; let best = null, bd = 1e9; P.forEach((p) => { if (p.snow) return; const d = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (d < p.r + 26 && d < bd) { best = p; bd = d; } }); if (best) pop(best); else rings.push({ x: e.clientX, y: e.clientY, r: 6, a: 1 }); }, { passive: true });
  window.__burst = (x, y) => { for (let k = 0; k < 34; k++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 120 + Math.random() * 260; drops.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 2 + Math.random() * 5, a: 1, ring: true }); } rings.push({ x, y, r: 10, a: 1 }); };
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') addEventListener('deviceorientation', (e) => { if (e.gamma != null) tilt += (Math.max(-30, Math.min(30, e.gamma)) / 30 - tilt) * 0.2; }, { passive: true });
  let lastY = scrollY, vel = 0, last = performance.now(), rate = 1;
  const dz = $('#dz'), mDisp = $('#mDisp'), mBlur = $('#mBlur'), mTurb = $('#mTurb'); let melting = false, lastMp = -1, lastScrollAt = 0;
  addEventListener('scroll', () => { lastScrollAt = performance.now(); }, { passive: true });
  /* modo leve: celular fraco, economia de dados ou quadros lentos nos primeiros segundos */
  let lite = false, sampled = 0, slow = 0;
  const goLite = () => { if (lite) return; lite = true; document.documentElement.classList.add('lite'); dz.style.filter = 'none'; melting = false; if (cx) cx.clearRect(0, 0, W, H); cv.style.display = 'none'; };
  if ((navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.connection && navigator.connection.saveData)) goLite();
  const rays = document.querySelector('.rays'); let docH = document.documentElement.scrollHeight;
  addEventListener('resize', () => { docH = document.documentElement.scrollHeight; }); setInterval(() => { docH = document.documentElement.scrollHeight; }, 2000);
  /* no celular, quando o dedo sai da tela as letras voltam ao lugar */
  const release = (e) => { if (e.pointerType !== 'mouse') px = py = -9999; };
  addEventListener('pointerup', release, { passive: true }); addEventListener('pointercancel', release, { passive: true });
  const frame = (t) => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    vel += ((scrollY - lastY) - vel) * 0.12; lastY = scrollY;
    /* parallax suave do herói */
    /* leituras primeiro: evita o navegador recalcular a página várias vezes por quadro */
    const heroOn = scrollY < innerHeight * 1.3;
    const lettersLive = heroOn && (px > -9000 || letters.some((L) => Math.abs(L.py) > 0.05));
    const rects = lettersLive ? letters.map((L) => L.el.getBoundingClientRect()) : null;
    const depth = Math.min(1, scrollY / Math.max(1, docH - innerHeight));
    /* parallax suave do herói; os raios de sol apagam conforme você desce */
    /* mede os primeiros quadros de rolagem: se estiverem lentos, liga o modo leve */
    if (!lite && t > 1200 && sampled < 90 && t - lastScrollAt < 180) { sampled++; if (dt > 0.022) slow++; if (sampled === 90 && slow > 30) goLite(); }
    /* a água embaralha e apaga o topo conforme a pessoa rola; só mexe enquanto rola */
    if (heroOn) {
      const mp = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.72)));
      const rolando = t - lastScrollAt < 180;
      if (mp > 0.004) {
        dz.style.visibility = mp > 0.985 ? 'hidden' : '';
        if (lite) { dz.style.opacity = (1 - Math.pow(mp, 1.4) * 0.95).toFixed(3); }
        else if (mp !== lastMp || rolando) {
          if (!melting) { dz.style.filter = 'url(#melt)'; melting = true; }
          mDisp.setAttribute('scale', (Math.pow(mp, 1.25) * 120).toFixed(1));
          mBlur.setAttribute('stdDeviation', (mp * mp * 7).toFixed(2));
          if (rolando) mTurb.setAttribute('baseFrequency', (0.007 + 0.0025 * Math.sin(t / 820)).toFixed(4) + ' ' + (0.03 + 0.01 * Math.sin(t / 1150 + 1.3)).toFixed(4));
          dz.style.opacity = (1 - Math.pow(mp, 1.4) * 0.95).toFixed(3);
        }
        lastMp = mp;
      } else if (melting || lastMp > 0) { dz.style.filter = 'none'; dz.style.opacity = ''; dz.style.visibility = ''; mDisp.setAttribute('scale', '0'); melting = false; lastMp = 0; }
    }
    if (heroOn) { w.style.transform = 'translate3d(0,' + (scrollY * 0.22).toFixed(1) + 'px,0)'; if (rays) { rays.style.transform = 'translate3d(0,' + (scrollY * 0.12).toFixed(1) + 'px,0) rotate(' + (tilt * 3).toFixed(2) + 'deg)'; rays.style.opacity = Math.max(0, 1 - scrollY / (innerHeight * 0.95)).toFixed(3); } }
    /* faixa acelera com a rolagem */
    if (beltAnim) { const tr = 1 + Math.min(5, Math.abs(vel) * 0.25); rate += (tr - rate) * 0.08; beltAnim.playbackRate = rate; }
    /* letras */
    if (lettersLive) letters.forEach((L, k) => { const r = rects[k]; const cxp = r.left + r.width / 2, cyp = r.top + r.height / 2 - L.py; const dx = px - cxp, dy = py - cyp; const dist = Math.hypot(dx, dy); const inf = Math.max(0, 1 - dist / 190); L.tg = -(inf * inf) * 46 * (dy > 0 ? 1 : -0.6); L.py += (L.tg - L.py) * 0.12; L.el.style.setProperty('--py', L.py.toFixed(2) + 'px'); });
    /* partículas */
    if (cx && !lite) { cx.clearRect(0, 0, W, H); const boost = vel * 22; const bubA = (0.42 * (1 - 0.45 * depth)).toFixed(3), snowA = (0.18 + 0.24 * depth).toFixed(3); P.forEach((p) => { p.y -= (p.v + boost) * dt; p.x += Math.sin(t / 1400 + p.ph) * 12 * dt + tilt * (p.snow ? 14 : 34) * dt; const ddx = p.x - px, ddy = p.y - py, dd = Math.hypot(ddx, ddy); if (dd < 90 && dd > 0) { p.x += (ddx / dd) * (90 - dd) * 0.05; p.y += (ddy / dd) * (90 - dd) * 0.05; } if (p.y < -12) { p.y = H + 12; p.x = Math.random() * W; } else if (p.y > H + 14) { p.y = -10; p.x = Math.random() * W; } if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.snow) { cx.fillStyle = 'rgba(230,246,243,' + snowA + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.fill(); } else { cx.strokeStyle = 'rgba(230,246,243,' + bubA + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 6.283); cx.stroke(); cx.strokeStyle = 'rgba(255,255,255,0.55)'; cx.beginPath(); cx.arc(p.x, p.y, p.r * 0.62, 3.6, 4.5); cx.stroke(); } }); }
    if (cx) {
      for (let i = rings.length - 1; i >= 0; i--) { const g = rings[i]; g.r += 150 * dt; g.a -= 1.25 * dt; if (g.a <= 0) { rings.splice(i, 1); continue; } cx.strokeStyle = 'rgba(255,210,122,' + (g.a * 0.85).toFixed(2) + ')'; cx.lineWidth = 2; cx.beginPath(); cx.arc(g.x, g.y, g.r, 0, 6.283); cx.stroke(); }
      for (let i = drops.length - 1; i >= 0; i--) { const q = drops[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.985; q.vy = q.vy * 0.985 - 40 * dt; q.a -= 1.35 * dt; if (q.a <= 0) { drops.splice(i, 1); continue; } if (q.ring) { cx.strokeStyle = 'rgba(255,226,160,' + q.a.toFixed(2) + ')'; cx.lineWidth = 1.6; cx.beginPath(); cx.arc(q.x, q.y, q.r, 0, 6.283); cx.stroke(); } else { cx.fillStyle = 'rgba(230,246,243,' + q.a.toFixed(2) + ')'; cx.beginPath(); cx.arc(q.x, q.y, q.r, 0, 6.283); cx.fill(); } }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

/* ===== CONTAGEM REGRESSIVA E LIBERAÇÃO AUTOMÁTICA DO TEMA ===== */
(() => {
  /* atalhos da equipe:  ?revelar  faz a revelação em 10 segundos;  ?suspense  mostra o cronômetro mesmo depois da data */
  const qsT = new URLSearchParams(location.search);
  let target = new Date(CONFIG.themeRelease || '2026-11-21T20:00:00-03:00').getTime();
  if (qsT.has('revelar')) target = Date.now() + 10000;
  else if (qsT.has('suspense') && target <= Date.now()) target = Date.now() + 3 * 86400000 + 5 * 3600000;
  const reduzMov = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let contando = false;
  const themeBox = $('#themeTimerBox');
  const footBox = $('#themeTimerFoot');
  const tcD = $('#tcD'), tcH = $('#tcH'), tcM = $('#tcM'), tcS = $('#tcS');
  const word = $('#word');
  const footLogo = $('.foot-logo svg');

  const reveal = (animar) => {
    const caps = $('#themeCountdown');
    const fim = () => {
      if (themeBox) themeBox.remove();
      if (word) {
        word.classList.add('revealed');
        word.setAttribute('aria-label', CONFIG.camp);
        /* as letras do IMERSOS emergem da água de novo */
        if (animar) word.querySelectorAll('.ch > i').forEach((i) => { i.style.animation = 'none'; void i.offsetWidth; i.style.animation = ''; });
      }
    };
    if (animar && caps && !reduzMov) {
      caps.classList.add('transborda');
      setTimeout(() => caps.classList.add('some'), 800);
      setTimeout(fim, 1500);
    } else fim();
    if (footLogo) footLogo.classList.add('revealed');
    if (footBox) {
      footBox.innerHTML = '<span class="suspense-pill revealed">✨ Tema Oficial: ' + CONFIG.camp.toUpperCase() + '</span>';
    }
    const belt = $('#belt');
    if (belt && !belt.dataset.revealed) {
      belt.dataset.revealed = 'true';
      belt.querySelectorAll('span').forEach((sp) => {
        if (sp.textContent.includes('TEMA EM BREVE')) {
          sp.textContent = CONFIG.camp.toUpperCase() + ' ≈';
        }
      });
    }
  };

  const tick = () => {
    const diff = target - Date.now();
    if (diff <= 0) {
      reveal(contando);
      return false;
    }
    contando = true;
    const s = Math.floor(diff / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;

    if (tcD) tcD.textContent = String(d).padStart(2, '0');
    if (tcH) tcH.textContent = String(h).padStart(2, '0');
    if (tcM) tcM.textContent = String(m).padStart(2, '0');
    if (tcS) tcS.textContent = String(sec).padStart(2, '0');
    /* água das cápsulas: sobe conforme a revelação chega (dias: últimos 30 dias) */
    const niveis = [1 - Math.min(d, 30) / 30, 1 - h / 24, 1 - m / 60, 1 - sec / 60];
    document.querySelectorAll('.tm-cap').forEach((c, i) => c.style.setProperty('--lv', Math.max(0.08, Math.min(1, niveis[i])).toFixed(3)));
    const tcFoot = $('#tcFoot');
    if (tcFoot) {
      tcFoot.textContent = d + 'd ' + String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm ' + String(sec).padStart(2, '0') + 's';
    }
    return true;
  };

  if (tick()) {
    const iv = setInterval(() => {
      if (!tick()) clearInterval(iv);
    }, 1000);
  }
})();
