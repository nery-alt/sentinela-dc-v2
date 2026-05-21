const SAD_URL = 'https://okdghwjcpnkkxcrvjaxg.supabase.co';
const SAD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZGdod2pjcG5ra3hjcnZqYXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTAyNTcsImV4cCI6MjA5MjYyNjI1N30.vmOiB1gvxvyD74EZ6DGal_rVHxucdU6waJoqoyFCj2k';

export type PessoaSAD = {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  endereco: string;
  orgao: string;
};

export async function buscarPessoasSAD(query: string): Promise<PessoaSAD[]> {
  const params = new URLSearchParams({
    select: 'id,nome,cpf,telefone,endereco,orgao',
    or: `(nome.ilike.*${query}*,orgao.ilike.*${query}*)`,
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
// Retorna a URL pública do arquivo ou lança erro
export async function uploadPdfParaSAD(
  uri: string,
  nomeArquivo: string,
): Promise<string> {
  // Lê o arquivo como blob
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

  // Monta URL pública
  const publicUrl = `${SAD_URL}/storage/v1/object/public/documentos/${path}`;
  return publicUrl;
}

// Registra o PDF enviado na tabela documentos_recebidos do SAD
export async function registrarDocumentoSAD(params: {
  nome: string;         // nome exibido no SAD
  url: string;          // URL pública retornada pelo upload
  pessoaId?: string;    // id da pessoa no SAD (opcional)
  descricao?: string;   // ex: "Laudo de Vistoria — protocolo 001"
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
