// Listas e regras da Vistoria (ocorrência), alinhadas ao Relatório Técnico de Vistoria do SAD.
// As siglas dos órgãos são as mesmas do SAD: assim o relatório já abre com os órgãos marcados.

export const TIPOS_OCORRENCIA = [
  'Edificação (dano estrutural)',
  'Muro',
  'Barranco / erosão / terras caídas',
  'Incêndio',
  'Chuvas intensas / alagamento',
  'Vendaval / destelhamento',
  'Cheia / enchente',
  'Ponte / passarela',
  'Árvore',
  'Rede elétrica / poste',
  'Espaço público (escola, creche, praça)',
  'Instalação temporária (parquinho, circo, evento)',
  'Outros',
];

// Tipos em que não há "imóvel do solicitante" (tipo de imóvel, material, propriedade, situação)
const SEM_IMOVEL = ['Ponte / passarela', 'Árvore', 'Rede elétrica / poste', 'Instalação temporária (parquinho, circo, evento)'];
export const mostraImovel = (tipo: string) => !SEM_IMOVEL.includes(tipo);

export const NIVEIS_RISCO = ['Baixo', 'Médio', 'Alto', 'Muito Alto'];

export const MEDIDAS = [
  'Interdição total',
  'Interdição parcial',
  'Isolamento e sinalização da área',
  'Desocupação do imóvel',
  'Demolição / desmontagem',
  'Escoramento ou reparo emergencial',
  'Avaliação por engenheiro',
  'Monitoramento / reavaliação',
  'Aluguel social / benefício eventual',
  'Poda ou supressão de árvore',
  'Notificação do responsável',
  'Acesso ou travessia provisória',
];

// sigla gravada (igual ao SAD) -> texto do botão
export const ORGAOS_DESTINO: { sigla: string; rotulo: string }[] = [
  { sigla: 'SEMIO', rotulo: 'SEMIO' },
  { sigla: 'SEMASC', rotulo: 'SEMASC' },
  { sigla: 'GABINETE', rotulo: 'Gabinete do Prefeito' },
  { sigla: 'SEMMALP', rotulo: 'SEMMALP' },
  { sigla: 'SAAE', rotulo: 'SAAE' },
  { sigla: 'AMAZONAS ENERGIA', rotulo: 'Amazonas Energia' },
  { sigla: 'SEMED', rotulo: 'SEMED' },
  { sigla: 'CBMAM', rotulo: 'CBMAM' },
  { sigla: 'DEFENSORIA', rotulo: 'Defensoria Pública' },
  { sigla: 'PGM', rotulo: 'PGM' },
  { sigla: 'Outros', rotulo: 'Outro órgão' },
];

export const lerLista = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== 'string' || !v) return [];
  try { const l = JSON.parse(v); return Array.isArray(l) ? l.map(String) : []; } catch { return []; }
};

// "SEMIO, PGM, Secretaria Municipal de Saúde – SEMSA" (o "Outros" vira o nome digitado)
export function textoOrgaos(orgaos: string[], outro: string): string {
  return orgaos.map(o => (o === 'Outros' ? (outro || '').trim() : o === 'SEMMA' ? 'SEMMALP' : o)).filter(Boolean).join(', ');
}

// Lembrete na hora de salvar: o que ficou em branco (nada é obrigatório)
export function camposEmBranco(f: any): string[] {
  const falta: string[] = [];
  if (f.origem_tipo === 'orgao') {
    if (!String(f.orgao_demandante || '').trim()) falta.push('Órgão que pediu a vistoria');
    if (!String(f.documento_origem || '').trim()) falta.push('Documento de origem (ofício, memorando…)');
  } else if (!String(f.nome_solicitante || '').trim()) falta.push('Nome do solicitante');
  if (!String(f.protocolo || '').trim()) falta.push('Protocolo do SAD (sem ele não dá para enviar)');
  if (!String(f.endereco || '').trim()) falta.push('Endereço / local da ocorrência');
  if (!f.gps_lat) falta.push('GPS');
  if (!f.tipificacao) falta.push('Tipo de ocorrência');
  if (!f.nivel_risco) falta.push('Nível de risco');
  if (!String(f.descricao_situacao || '').trim()) falta.push('O que constatei');
  if (!(f.medidas || []).length && !(f.orgao_destino || []).length && !String(f.recomendacoes || '').trim()) falta.push('Medidas / encaminhamento');
  const fotos = f.fotos || [];
  if (!fotos.length) falta.push('Fotos');
  else {
    const sem = fotos.filter((x: any) => !String(x.legenda || '').trim()).length;
    if (sem) falta.push(`Legenda de ${sem} foto(s)`);
  }
  return falta;
}
