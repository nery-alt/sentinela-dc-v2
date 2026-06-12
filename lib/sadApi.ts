const SAD_URL = 'https://okdghwjcpnkkxcrvjaxg.supabase.co';
const SAD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZGdod2pjcG5ra3hjcnZqYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTAyNTcsImV4cCI6MjA5MjYyNjI1N30.vmOiB1gvxvyD74EZ6DGal_rVHxucdU6waJoqoyFCj2k';

export type PessoaSAD = {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  data_nascimento: string;
  genero: string;
  estado_civil: string;
  telefone: string;
  email: string;
  endereco: string;
  bairro: string;
  municipio: string;
  cep: string;
  ponto_referencia: string;
  gps_lat: number | null;
  gps_lng: number | null;
  orgao: string;
  renda_familiar: string;
  tipo_moradia: string;
  material_construcao: string;
  area_risco: boolean | null;
  deficiencia: string;
  doenca_cronica: string;
  prioridade: string;
};

export async function buscarPessoasSAD(query: string): Promise<PessoaSAD[]> {
  const campos = [
    'id', 'nome', 'cpf', 'rg', 'data_nascimento', 'genero', 'estado_civil',
    'telefone', 'email', 'endereco', 'bairro', 'municipio', 'cep',
    'ponto_referencia', 'gps_lat', 'gps_lng', 'orgao',
    'renda_familiar', 'tipo_moradia', 'material_construcao',
    'area_risco', 'deficiencia', 'doenca_cronica', 'prioridade',
  ].join(',');

  const params = new URLSearchParams({
    select: campos,
    or: `(nome.ilike.*${query}*,orgao.ilike.*${query}*,cpf.ilike.*${query}*)`,
    limit: '20',
  });

  const res = await fetch(`${SAD_URL}/rest/v1/pessoas?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${SAD_KEY}`,
      apikey: SAD_KEY,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[SAD] status=${res.status} body=${body}`);
    throw new Error(`SAD ${res.status}: ${body}`);
  }

  return res.json();
}

// Faz upload de um PDF (uri local) para o Storage do SAD
export async function uploadPdfParaSAD(
  uri: string,
  nomeArquivo: string,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `sentinela/${Date.now()}_${nomeArquivo}`;

  const uploadRes = await fetch(
    `${SAD_URL}/storage/v1/object/documentos/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${SAD_KEY}`,
        apikey: SAD_KEY,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
      },
      body: blob,
    },
  );

  if (!uploadRes.ok) {
    const body = await uploadRes.text();
    console.error(`[SAD] upload status=${uploadRes.status} body=${body}`);
    throw new Error(`Upload SAD ${uploadRes.status}: ${body}`);
  }

  return `${SAD_URL}/storage/v1/object/public/documentos/${path}`;
}

// Registra o PDF enviado na tabela documentos_recebidos do SAD
export async function registrarDocumentoSAD(params: {
  nome: string;
  url: string;
  pessoaId?: string;
  descricao?: string;
}): Promise<void> {
  const payload: Record<string, any> = {
    nome: params.nome,
    caminho: params.url,
    tipo: 'PDF',
    descricao: params.descricao || null,
    pessoa_id: params.pessoaId || null,
  };

  const res = await fetch(`${SAD_URL}/rest/v1/documentos_recebidos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SAD_KEY}`,
      apikey: SAD_KEY,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[SAD] registro status=${res.status} body=${body}`);
    throw new Error(`Registro SAD ${res.status}: ${body}`);
  }
}

// =============================================================
// ETAPA 3 — Ocorrências georreferenciadas
// Grava o "gêmeo estruturado" do PDF na tabela ocorrencias do SAD.
// Alimenta o Mapa de Ocorrências e o Módulo de Situação de Emergência.
// =============================================================

export type OcorrenciaSAD = {
  sentinela_id: string;           // id da vistoria no app (chave de idempotência)
  pessoa_id?: string | null;      // id da pessoa no SAD (bigint, enviado como string)
  documento_url?: string | null;  // URL do PDF no Storage (preenchido no envio)
  protocolo?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco?: string | null;
  bairro?: string | null;
  municipio_uf?: string | null;
  ponto_referencia?: string | null;
  data_vistoria?: string | null;  // 'YYYY-MM-DD'
  tipificacao?: string | null;
  tipificacao_outro?: string | null;
  nivel_risco?: string | null;
  localizacao?: string | null;
  tipo_imovel?: string | null;
  material_construcao?: string | null;
  propriedade?: string | null;
  pessoas_afetadas?: number | null;
  familias_afetadas?: number | null;
  descricao_situacao?: string | null;
  recomendacoes?: string | null;
  tipo_estrutura?: string | null;
  risco_estrutural?: string | null;
  obs_risco_estrutural?: string | null;
  risco_hidrologico?: string | null;
  orgao_destino?: string | null;
  situacao_imovel?: string | null;
  reavaliacao?: boolean | null;
  vistoriador_nome?: string | null;
  vistoriador_matricula?: string | null;
};

// Upsert por sentinela_id: reexportar a mesma vistoria ATUALIZA, não duplica.
export async function registrarOcorrenciaSAD(o: OcorrenciaSAD): Promise<void> {
  const payload: Record<string, any> = { origem: 'sentinela_v2', ...o };

  const res = await fetch(
    `${SAD_URL}/rest/v1/ocorrencias?on_conflict=sentinela_id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SAD_KEY}`,
        apikey: SAD_KEY,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[SAD] ocorrencia status=${res.status} body=${body}`);
    throw new Error(`Ocorrência SAD ${res.status}: ${body}`);
  }
}
