import { SAD_URL, SAD_KEY } from './sadConfig';
import { tokenSAD } from './sadAuth';

// Enquanto true: se o SAD recusar o login (401/403), repete UMA vez com a chave pública.
// Será desligada numa versão futura, quando todos estiverem usando login.
const PERMITIR_CHAVE_PUBLICA = true;

// Monta os cabeçalhos de autorização do SAD: prefere o token do login; sem login, usa a chave pública.
async function fetchSAD(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await tokenSAD();
  const montar = (bearer: string): RequestInit => ({
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), apikey: SAD_KEY, Authorization: `Bearer ${bearer}` },
  });
  if (!token) return fetch(url, montar(SAD_KEY));
  const res = await fetch(url, montar(token));
  if ((res.status === 401 || res.status === 403) && PERMITIR_CHAVE_PUBLICA) {
    console.warn('[sad] voltou para chave pública');
    return fetch(url, montar(SAD_KEY));
  }
  return res;
}

// Busca sem acento (funções buscar_*_sem_acento do SAD; só funcionam com login).
// Devolve null se não der (sem login, função ausente, erro, sem internet ou nada achado):
// aí quem chamou usa a busca antiga (ilike), que continua igual.
async function buscarSemAcentoSAD<T>(funcao: string, campos: string, query: string): Promise<T[] | null> {
  try {
    const res = await fetchSAD(`${SAD_URL}/rest/v1/rpc/${funcao}?${new URLSearchParams({ select: campos }).toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query }),
    });
    if (!res.ok) return null;
    const dados = await res.json();
    return Array.isArray(dados) && dados.length > 0 ? (dados as T[]) : null;
  } catch {
    return null;
  }
}

export type PessoaSAD = {
  id: string; nome: string; cpf: string; rg: string; data_nascimento: string;
  genero: string; estado_civil: string; telefone: string; email: string;
  endereco: string; bairro: string; municipio: string; cep: string;
  ponto_referencia: string; gps_lat: number | null; gps_lng: number | null;
  orgao: string; renda_familiar: string; tipo_moradia: string;
  material_construcao: string; area_risco: boolean | null;
  deficiencia: string; doenca_cronica: string; prioridade: string;
};

export async function buscarPessoasSAD(query: string): Promise<PessoaSAD[]> {
  const campos = [
    'id','nome','cpf','rg','data_nascimento','genero','estado_civil',
    'telefone','email','endereco','bairro','municipio','cep',
    'ponto_referencia','gps_lat','gps_lng','orgao',
    'renda_familiar','tipo_moradia','material_construcao',
    'area_risco','deficiencia','doenca_cronica','prioridade',
  ].join(',');
  const semAcento = await buscarSemAcentoSAD<PessoaSAD>('buscar_pessoas_sem_acento', campos, query);
  if (semAcento) return semAcento;
  const params = new URLSearchParams({
    select: campos,
    or: `(nome.ilike.*${query}*,orgao.ilike.*${query}*,cpf.ilike.*${query}*)`,
    limit: '20',
  });
  const res = await fetchSAD(`${SAD_URL}/rest/v1/pessoas?${params.toString()}`, {
    headers: {},
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`SAD ${res.status}: ${body}`); }
  return res.json();
}

// ALVARÁ — busca na tabela alvaras (traz o número AL junto com os dados)
export type AlvaraBuscaSAD = {
  id: number;
  numero: string | null;
  nome_estabelecimento: string;
  cnpj: string | null;
  nome_responsavel: string | null;
  cpf_responsavel: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  tipo_estabelecimento?: string | null;
  area_total?: number | null;
  capacidade_pessoas?: number | null;
  classificacao_porte?: string | null;
  classificacao_risco?: string | null;
};

export async function buscarAlvarasSAD(query: string): Promise<AlvaraBuscaSAD[]> {
  const campos = [
    'id', 'numero', 'nome_estabelecimento', 'cnpj', 'nome_responsavel',
    'cpf_responsavel', 'telefone', 'endereco', 'bairro', 'municipio',
    'gps_lat', 'gps_lng', 'tipo_estabelecimento', 'area_total', 'capacidade_pessoas',
    'classificacao_porte', 'classificacao_risco',
  ].join(',');

  const semAcento = await buscarSemAcentoSAD<AlvaraBuscaSAD>('buscar_alvaras_sem_acento', campos, query);
  if (semAcento) return semAcento;

  const params = new URLSearchParams({
    select: campos,
    or: `(nome_estabelecimento.ilike.*${query}*,nome_responsavel.ilike.*${query}*,numero.ilike.*${query}*)`,
    order: 'criado_em.desc',
    limit: '20',
  });

  const res = await fetchSAD(`${SAD_URL}/rest/v1/alvaras?${params.toString()}`, {
    headers: {},
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`SAD ${res.status}: ${body}`); }
  return res.json();
}

export async function uploadPdfParaSAD(uri: string, nomeArquivo: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `sentinela/${Date.now()}_${nomeArquivo}`;
  const uploadRes = await fetchSAD(`${SAD_URL}/storage/v1/object/documentos/${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/pdf', 'x-upsert': 'true',
    },
    body: blob,
  });
  if (!uploadRes.ok) { const body = await uploadRes.text(); throw new Error(`Upload SAD ${uploadRes.status}: ${body}`); }
  return `${SAD_URL}/storage/v1/object/public/documentos/${path}`;
}

export async function registrarDocumentoSAD(params: {
  nome: string; url: string; pessoaId?: string; descricao?: string;
}): Promise<void> {
  const payload: Record<string, any> = {
    nome: params.nome, caminho: params.url, tipo: 'PDF',
    descricao: params.descricao || null, pessoa_id: params.pessoaId || null,
  };
  const res = await fetchSAD(`${SAD_URL}/rest/v1/documentos_recebidos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Registro SAD ${res.status}: ${body}`); }
}

// =============================================================
// ETAPA 3 — Ocorrências (emergências) → tabela ocorrencias
// NÃO usar para Vistoria Técnica de alvará.
// =============================================================
export type OcorrenciaSAD = {
  sentinela_id: string; pessoa_id?: string | null; documento_url?: string | null;
  protocolo?: string | null; latitude?: number | null; longitude?: number | null;
  endereco?: string | null; bairro?: string | null; municipio_uf?: string | null;
  ponto_referencia?: string | null; data_vistoria?: string | null;
  tipificacao?: string | null; tipificacao_outro?: string | null;
  nivel_risco?: string | null; localizacao?: string | null;
  tipo_imovel?: string | null; material_construcao?: string | null;
  propriedade?: string | null; pessoas_afetadas?: number | null;
  familias_afetadas?: number | null; descricao_situacao?: string | null;
  recomendacoes?: string | null; tipo_estrutura?: string | null;
  risco_estrutural?: string | null; obs_risco_estrutural?: string | null;
  risco_hidrologico?: string | null; orgao_destino?: string | null;
  situacao_imovel?: string | null; reavaliacao?: boolean | null;
  vistoriador_nome?: string | null; vistoriador_matricula?: string | null;
};

export async function registrarOcorrenciaSAD(o: OcorrenciaSAD): Promise<void> {
  const payload: Record<string, any> = { origem: 'sentinela_v2', ...o };
  const res = await fetchSAD(`${SAD_URL}/rest/v1/ocorrencias?on_conflict=sentinela_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Ocorrência SAD ${res.status}: ${body}`); }
}

// =============================================================
// ALVARÁ — Vistoria Técnica de estabelecimento → tabela alvaras
// Separado de ocorrencias. Chamado pelo módulo Vistoria Técnica.
// =============================================================
export type AlvaraSAD = {
  sentinela_id: string;
  pessoa_id?: string | null;
  documento_url?: string | null;
  numero?: string | null;
  nome_estabelecimento: string;
  cnpj?: string | null;
  nome_responsavel?: string | null;
  cpf_responsavel?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  gps_lat?: number | null;
  gps_lng?: number | null;
  tipo_estabelecimento?: string | null;
  area_total?: number | null;
  capacidade_pessoas?: number | null;
  possui_extintor?: boolean | null;
  qtd_extintores?: number | null;
  tipo_extintor?: string | null;
  extintor_validade?: boolean | null;
  extintor_localizacao_ok?: boolean | null;
  sinalizacao_emergencia?: boolean | null;
  saida_desobstruida?: boolean | null;
  qtd_saidas?: number | null;
  rotas_fuga_ok?: boolean | null;
  instalacao_irregular?: boolean | null;
  possui_glp?: boolean | null;
  glp_armazenamento_ok?: boolean | null;
  sistema_fixo_incendio?: boolean | null;
  qual_sistema_fixo?: string | null;
  iluminacao_emergencia?: boolean | null;
  obs_iluminacao?: string | null;
  hidrante_reserva?: boolean | null;
  obs_hidrante?: string | null;
  planta_baixa?: boolean | null;
  obs_planta_baixa?: string | null;
  apto_alvara?: boolean | null;
  necessita_adequacoes?: boolean | null;
  observacoes?: string | null;
  descricao_tecnica?: string | null;
  situacao_imovel?: string | null;
  reavaliacao?: boolean | null;
  orgao_destino?: string | null;
  qual_orgao_outro?: string | null;
  nome_vistoriador?: string | null;
  matricula_vistoriador?: string | null;
  data_vistoria?: string | null;
};

export async function registrarAlvaraSAD(a: AlvaraSAD): Promise<void> {
  const payload: Record<string, any> = { origem: 'sentinela_v2', ...a };
  const res = await fetchSAD(`${SAD_URL}/rest/v1/alvaras?on_conflict=sentinela_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Alvará SAD ${res.status}: ${body}`); }
}
// =============================================================
// Alvará: envio da vistoria em campo para o SAD
// Usa a "porta de entrada" receber-alvara do SAD, que só atualiza
// um alvará que já existe (pelo número AL) e só os campos da vistoria.
// =============================================================
export type FotoAlvara = { uri: string; legenda: string };

export async function uploadFotoAlvaraSAD(uri: string, numero: string, ordem: number): Promise<string> {
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const num = numero.replace(/[^A-Za-z0-9]+/g, '-');
  const path = `sentinela/alvaras/${num}_${ordem}_${Date.now()}.jpg`;
  const up = await fetchSAD(`${SAD_URL}/storage/v1/object/documentos/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: blob,
  });
  if (!up.ok) { const body = await up.text(); throw new Error(`Foto ${ordem}: ${up.status} ${body}`); }
  return `${SAD_URL}/storage/v1/object/public/documentos/${path}`;
}

export async function enviarAlvaraSAD(params: {
  numero: string;
  campos: Record<string, unknown>;
  fotos: { ordem: number; url: string; legenda: string }[];
}): Promise<{ campos: number; fotos: number }> {
  const res = await fetchSAD(`${SAD_URL}/functions/v1/receber-alvara`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || !dados.ok) throw new Error(dados.error || `SAD respondeu ${res.status}`);
  return { campos: dados.campos ?? 0, fotos: dados.fotos ?? 0 };
}

// =============================================================
// Vistoria (ocorrência): envio para o SAD pela porta receber-vistoria.
// Só aceita vistoria ligada a um protocolo que já existe no SAD (ex.: 144/2026).
// Grava a ocorrência e as fotos do anexo do Relatório Técnico de Vistoria.
// =============================================================
export async function uploadFotoVistoriaSAD(uri: string, protocolo: string, ordem: number): Promise<string> {
  const resp = await fetch(uri);
  const blob = await resp.blob();
  const num = protocolo.replace(/[^A-Za-z0-9]+/g, '-');
  const path = `sentinela/vistorias/${num}_${ordem}_${Date.now()}.jpg`;
  const up = await fetchSAD(`${SAD_URL}/storage/v1/object/documentos/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: blob,
  });
  if (!up.ok) { const body = await up.text(); throw new Error(`Foto ${ordem}: ${up.status} ${body}`); }
  return `${SAD_URL}/storage/v1/object/public/documentos/${path}`;
}

export async function enviarVistoriaSAD(params: {
  protocolo: string;
  sentinela_id: string;
  campos: Record<string, unknown>;
  fotos: { ordem: number; url: string; legenda: string }[];
}): Promise<{ protocolo: string; campos: number; fotos: number; semEspaco: number }> {
  const res = await fetchSAD(`${SAD_URL}/functions/v1/receber-vistoria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const dados = await res.json().catch(() => ({}));
  if (!res.ok || !dados.ok) throw new Error(dados.error || `SAD respondeu ${res.status}`);
  return { protocolo: dados.protocolo, campos: dados.campos ?? 0, fotos: dados.fotos ?? 0, semEspaco: dados.sem_espaco ?? 0 };
}

// =============================================================
// Conferência antes de enviar a vistoria: SÓ LEITURA, nunca lança erro.
// Devolve null se não conseguir conferir em ~5 s (sem internet, sem login, erro, protocolo não achado).
// =============================================================
export type ConferenciaProtocolo = { numero: string; assunto: string; status: string; dono: string };

export async function conferirProtocoloSAD(protocolo: string, limiteMs = 5000): Promise<ConferenciaProtocolo | null> {
  const consulta = async (): Promise<ConferenciaProtocolo | null> => {
    const numero = protocolo.replace(/\s+/g, '');
    const q = new URLSearchParams({ numero: `eq.${numero}`, select: 'numero,assunto,status,pessoa_id', limit: '1' });
    const res = await fetchSAD(`${SAD_URL}/rest/v1/protocolos?${q.toString()}`);
    if (!res.ok) return null;
    const lista = await res.json();
    const p = Array.isArray(lista) ? lista[0] : null;
    if (!p) return null;
    let dono = '';
    if (p.pessoa_id) {
      const qp = new URLSearchParams({ id: `eq.${p.pessoa_id}`, select: 'nome', limit: '1' });
      const rp = await fetchSAD(`${SAD_URL}/rest/v1/pessoas?${qp.toString()}`);
      if (rp.ok) {
        const pessoas = await rp.json();
        dono = (Array.isArray(pessoas) && pessoas[0]?.nome) || '';
      }
    }
    return { numero: String(p.numero ?? numero), assunto: String(p.assunto ?? ''), status: String(p.status ?? ''), dono: String(dono) };
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      consulta().catch(() => null),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), limiteMs); }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
