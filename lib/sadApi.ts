const SAD_URL = 'https://okdghwjcpnkkxcrvjaxg.supabase.co';
const SAD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZGdod2pjcG5ra3hjcnZqYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTAyNTcsImV4cCI6MjA5MjYyNjI1N30.vmOiB1gvxvyD74EZ6DGal_rVHxucdU6waJoqoyFCj2k';

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
  const params = new URLSearchParams({
    select: campos,
    or: `(nome.ilike.*${query}*,orgao.ilike.*${query}*,cpf.ilike.*${query}*)`,
    limit: '20',
  });
  const res = await fetch(`${SAD_URL}/rest/v1/pessoas?${params.toString()}`, {
    headers: { Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY },
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
};

export async function buscarAlvarasSAD(query: string): Promise<AlvaraBuscaSAD[]> {
  const campos = [
    'id', 'numero', 'nome_estabelecimento', 'cnpj', 'nome_responsavel',
    'cpf_responsavel', 'telefone', 'endereco', 'bairro', 'municipio',
    'gps_lat', 'gps_lng',
  ].join(',');

  const params = new URLSearchParams({
    select: campos,
    or: `(nome_estabelecimento.ilike.*${query}*,nome_responsavel.ilike.*${query}*,numero.ilike.*${query}*)`,
    order: 'criado_em.desc',
    limit: '20',
  });

  const res = await fetch(`${SAD_URL}/rest/v1/alvaras?${params.toString()}`, {
    headers: { Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY },
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`SAD ${res.status}: ${body}`); }
  return res.json();
}

export async function uploadPdfParaSAD(uri: string, nomeArquivo: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `sentinela/${Date.now()}_${nomeArquivo}`;
  const uploadRes = await fetch(`${SAD_URL}/storage/v1/object/documentos/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY,
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
  const res = await fetch(`${SAD_URL}/rest/v1/documentos_recebidos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY,
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
  const res = await fetch(`${SAD_URL}/rest/v1/ocorrencias?on_conflict=sentinela_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY,
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
  const res = await fetch(`${SAD_URL}/rest/v1/alvaras?on_conflict=sentinela_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SAD_KEY}`, apikey: SAD_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`Alvará SAD ${res.status}: ${body}`); }
}