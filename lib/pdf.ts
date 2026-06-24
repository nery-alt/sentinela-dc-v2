import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { getSettings, AppSettings } from '../hooks/useSettings';
import { uploadPdfParaSAD, registrarDocumentoSAD, registrarOcorrenciaSAD, OcorrenciaSAD } from './sadApi';

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1a1a1a; background: #ffffff; }
.header { background: #ffffff; color: #1a1a1a; padding: 18px 22px 14px; border-bottom: 2px solid #333333; }
.header-title { font-size: 14px; font-weight: bold; margin-bottom: 3px; }
.header-sub { font-size: 12px; color: #333333; margin-bottom: 10px; }
.header-doc { font-size: 14px; font-weight: bold; color: #1a1a1a; text-transform: uppercase; margin-bottom: 10px; }
.header-meta { display: flex; justify-content: space-between; font-size: 12px; color: #333333; border-top: 1px solid #cccccc; padding-top: 8px; }
.section { margin: 10px 18px 0; border: 1px solid #cccccc; overflow: hidden; page-break-inside: avoid; }
.section-title { background: #f5f5f5; color: #1a1a1a; padding: 6px 12px; font-size: 12px; font-weight: bold; border-bottom: 1px solid #cccccc; }
table { width: 100%; border-collapse: collapse; }
tr:nth-child(even) { background: #fafafa; }
td { padding: 5px 10px; border-bottom: 1px solid #e0e0e0; font-size: 12px; vertical-align: top; }
td.label { color: #333333; font-weight: bold; width: 40%; }
td.value { color: #1a1a1a; }
.result-banner { margin: 12px 18px 0; padding: 10px 14px; text-align: center; font-size: 12px; font-weight: bold; background: #ffffff; }
.result-apto { color: #2d6a2d; border: 2px solid #2d6a2d; }
.result-inapto { color: #8b1a1a; border: 2px solid #8b1a1a; }
.signatures { margin: 40px 18px 24px; display: flex; justify-content: space-around; }
.sig-block { text-align: center; width: 40%; }
.sig-line { border-top: 1px solid #333333; margin-bottom: 6px; }
.sig-name { font-size: 12px; font-weight: bold; margin-top: 4px; }
.sig-role { font-size: 12px; color: #333333; margin-top: 2px; }
`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fv(val: any): string | null {
  if (val === null || val === undefined || val === '' || val === 0 || val === '0') return null;
  if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
  return String(val);
}

function row(label: string, val: any): string {
  const d = fv(val);
  if (!d) return '';
  return `<tr><td class="label">${esc(label)}</td><td class="value">${esc(d).replace(/\n/g, '<br>')}</td></tr>`;
}

function section(title: string, rows: string): string {
  const t = rows.trim();
  if (!t) return '';
  return `<div class="section"><div class="section-title">${esc(title)}</div><table>${t}</table></div>`;
}

function buildHeader(s: AppSettings, docType: string, protocolo: string): string {
  const d = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `<div class="header">
    <div class="header-title">${esc(s.nomeSecretaria || 'Secretaria Municipal')}</div>
    <div class="header-sub">${esc(s.municipioUF || '')}</div>
    <div class="header-doc">${esc(docType)}</div>
    <div class="header-meta"><span>Gerado em: ${d}</span><span>Protocolo: ${esc(protocolo)}</span></div>
  </div>`;
}

function buildSignatures(s: AppSettings, visitadoLabel: string): string {
  const nome = esc(s.nomeVistoriador || '_________________________');
  const cargo = esc(s.cargo || 'Vistoriador');
  return `<div class="signatures">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${nome}</div>
      <div class="sig-role">${cargo}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">_________________________</div>
      <div class="sig-role">${esc(visitadoLabel)}</div>
    </div>
  </div>`;
}

function makeHtml(header: string, body: string, sigs: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${header}${body}${sigs}</body></html>`;
}

// Remove caracteres inválidos para nome de arquivo (barra, barra invertida, etc.)
function sanitizeFileName(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '-');
}

// Formata a data no fuso LOCAL do aparelho como 'YYYY-MM-DD'
// (evita o off-by-one do UTC em vistorias feitas à noite em Tefé).
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Metadados opcionais para envio ao SAD
type SadMeta = {
  nomeArquivo: string;
  descricao: string;
  pessoaId?: string;
  ocorrencia?: OcorrenciaSAD;   // quando presente, grava também em ocorrencias
};

async function printAndShare(html: string, sadMeta: SadMeta): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Salvar ou compartilhar PDF',
    UTI: 'com.adobe.pdf',
  });

  Alert.alert(
    'Enviar ao SAD?',
    `Deseja salvar "${sadMeta.descricao}" no Sistema SAD?`,
    [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim',
        onPress: async () => {
          try {
            const url = await uploadPdfParaSAD(uri, sadMeta.nomeArquivo);
            await registrarDocumentoSAD({
              nome: sadMeta.nomeArquivo,
              url,
              pessoaId: sadMeta.pessoaId,
              descricao: sadMeta.descricao,
            });

            // Grava a ocorrência estruturada (mapa + Situação de Emergência).
            // Em try próprio: se falhar, o PDF JÁ está salvo; avisamos sem alarmar.
            if (sadMeta.ocorrencia) {
              try {
                await registrarOcorrenciaSAD({ ...sadMeta.ocorrencia, documento_url: url });
                Alert.alert('SAD', 'Documento e ocorrência enviados com sucesso!');
              } catch (oe: any) {
                console.error('[SAD] erro ao gravar ocorrência:', oe);
                Alert.alert('SAD', `PDF salvo. Mas a ocorrência (mapa/SE) não foi gravada:\n${oe.message}`);
              }
            } else {
              Alert.alert('SAD', 'Documento enviado com sucesso!');
            }
          } catch (e: any) {
            console.error('[SAD] erro ao enviar:', e);
            Alert.alert('Erro', `Não foi possível enviar ao SAD.\n${e.message}`);
          }
        },
      },
    ],
  );
}

export async function exportVistoriaPdf(r: any): Promise<void> {
  const s = await getSettings();
  const proto = (r.protocolo && String(r.protocolo).trim()) ? r.protocolo : '—';
  let orgaos = '';
  try { orgaos = r.orgao_destino ? JSON.parse(r.orgao_destino).join(', ') : ''; } catch { orgaos = r.orgao_destino || ''; }
  const gps = r.gps_lat ? `${Number(r.gps_lat).toFixed(6)}, ${Number(r.gps_lng).toFixed(6)}` : null;

  const body = [
    section('Dados do Solicitante', [
      row('Nome', r.nome_solicitante), row('CPF', r.cpf), row('RG', r.rg),
      row('Telefone', r.telefone), row('E-mail', r.email),
      row('Endereço', r.endereco), row('Bairro/Comunidade', r.bairro),
      row('Município/UF', r.municipio), row('Ponto de Referência', r.ponto_referencia),
      row('Protocolo', r.protocolo), row('GPS', gps),
    ].join('')),
    section('Dados da Vistoria', [
      row('Tipificação', r.tipificacao), row('Qual Tipificação (Outro)', r.qual_tipificacao_outro),
      row('Nível de Risco', r.nivel_risco), row('Localização', r.localizacao),
      row('Tipo de Imóvel', r.tipo_imovel), row('Material de Construção', r.material_construcao),
      row('Qual Material (Outro)', r.qual_material_outro), row('Propriedade', r.propriedade),
    ].join('')),
    section('Danos', [
      row('Desabrigados', r.desabrigados), row('Desalojados', r.desalojados),
      row('Pessoas Afetadas', r.pessoas_afetadas), row('Famílias Afetadas', r.familias_afetadas),
      row('Danos Materiais', r.danos_materiais), row('Endereço da Ocorrência', r.endereco_ocorrencia),
      row('Descrição da Situação', r.descricao_situacao), row('Recomendações', r.recomendacoes),
    ].join('')),
    section('Estrutura e Riscos', [
      row('Tipo de Estrutura', r.tipo_estrutura), row('Qual Estrutura (Outro)', r.qual_estrutura_outro),
      row('Risco Estrutural', r.risco_estrutural), row('Obs. Risco Estrutural', r.obs_risco_estrutural),
      row('Risco Hidrológico', r.risco_hidrologico), row('Obs. Risco Hidrológico', r.obs_risco_hidrologico),
    ].join('')),
    section('Encaminhamento', [
      row('Órgão Destino', orgaos || null), row('Qual Órgão (Outro)', r.qual_orgao_outro),
      row('Situação do Imóvel', r.situacao_imovel), row('Reavaliação', r.reavaliacao),
    ].join('')),
    section('Vistoriador', [
      row('Nome', r.nome_vistoriador), row('Matrícula', r.matricula),
    ].join('')),
  ].join('');

  const protoSafe = sanitizeFileName(proto);

  const ocorrencia: OcorrenciaSAD = {
    sentinela_id: String(r.id),
    pessoa_id: r.sad_pessoa_id || null,
    protocolo: r.protocolo ?? null,
    latitude: r.gps_lat != null ? Number(r.gps_lat) : null,
    longitude: r.gps_lng != null ? Number(r.gps_lng) : null,
    endereco: r.endereco ?? null,
    bairro: r.bairro ?? null,
    municipio_uf: r.municipio ?? null,
    ponto_referencia: r.ponto_referencia ?? null,
    data_vistoria: ymdLocal(r.created_at ? new Date(r.created_at) : new Date()),
    tipificacao: r.tipificacao ?? null,
    tipificacao_outro: r.qual_tipificacao_outro ?? null,
    nivel_risco: r.nivel_risco ?? null,
    localizacao: r.localizacao ?? null,
    tipo_imovel: r.tipo_imovel ?? null,
    material_construcao: r.material_construcao ?? null,
    propriedade: r.propriedade ?? null,
    pessoas_afetadas: r.pessoas_afetadas != null ? (Number(r.pessoas_afetadas) || 0) : 0,
    familias_afetadas: r.familias_afetadas != null ? (Number(r.familias_afetadas) || 0) : 0,
    descricao_situacao: r.descricao_situacao ?? null,
    recomendacoes: r.recomendacoes ?? null,
    tipo_estrutura: r.tipo_estrutura ?? null,
    risco_estrutural: r.risco_estrutural ?? null,
    obs_risco_estrutural: r.obs_risco_estrutural ?? null,
    risco_hidrologico: r.risco_hidrologico ?? null,
    orgao_destino: orgaos || null,
    situacao_imovel: r.situacao_imovel ?? null,
    reavaliacao: r.reavaliacao === true || r.reavaliacao === 'Sim' || r.reavaliacao === 1 || r.reavaliacao === '1',
    vistoriador_nome: r.nome_vistoriador ?? null,
    vistoriador_matricula: r.matricula ?? null,
  };

  await printAndShare(
    makeHtml(buildHeader(s, 'Laudo de Vistoria', proto), body, buildSignatures(s, 'Responsável pelo Imóvel / Solicitante')),
    {
      nomeArquivo: `vistoria_${protoSafe}.pdf`,
      descricao: `Laudo de Vistoria — Protocolo ${proto}`,
      pessoaId: r.sad_pessoa_id,
      ocorrencia,
    },
  );
}

export async function exportVistoriaTecnicaPdf(r: any): Promise<void> {
  const s = await getSettings();
  const proto = (r.protocolo && String(r.protocolo).trim()) ? r.protocolo : '—';
  let orgaos = '';
  try { orgaos = r.orgao_destino ? JSON.parse(r.orgao_destino).join(', ') : ''; } catch { orgaos = r.orgao_destino || ''; }
  const gps = r.gps_lat ? `${Number(r.gps_lat).toFixed(6)}, ${Number(r.gps_lng).toFixed(6)}` : null;
  const resultadoBanner = r.apto_alvara === true
    ? `<div class="result-banner result-apto">&#10003; APTO PARA ALVARÁ</div>`
    : r.apto_alvara === false
    ? `<div class="result-banner result-inapto">&#10007; INAPTO &#8212; NECESSITA ADEQUAÇÕES</div>`
    : '';

  const body = resultadoBanner + [
    section('Dados do Estabelecimento', [
      row('Nome do Estabelecimento', r.nome_estabelecimento),
      row('CNPJ', r.cnpj), row('Responsável', r.nome_responsavel),
      row('CPF do Responsável', r.cpf_responsavel), row('Telefone', r.telefone),
      row('Endereço', r.endereco), row('Bairro', r.bairro), row('GPS', gps),
      row('Tipo de Estabelecimento', r.tipo_estabelecimento),
      row('Área Total (m²)', r.area_total), row('Capacidade de Pessoas', r.capacidade_pessoas),
    ].join('')),
    section('Extintores', [
      row('Possui extintor', r.possui_extintor), row('Quantidade', r.qtd_extintores),
      row('Tipo do Extintor', r.tipo_extintor), row('Qual tipo (Outro)', r.qual_extintor_outro),
      row('Dentro do prazo', r.extintor_validade), row('Localização adequada', r.extintor_localizacao_ok),
    ].join('')),
    section('Saídas e Sinalização', [
      row('Sinalização de emergência', r.sinalizacao_emergencia),
      row('Saída desobstruída', r.saida_desobstruida),
      row('Qtd saídas de emergência', r.qtd_saidas), row('Rotas de fuga adequadas', r.rotas_fuga_ok),
    ].join('')),
    section('Instalações Elétricas e GLP', [
      row('Instalação irregular', r.instalacao_irregular), row('Possui GLP', r.possui_glp),
      row('GLP armazenado corretamente', r.glp_armazenamento_ok),
    ].join('')),
    section('Iluminação e Hidrante', [
      row('Iluminação de emergência', r.iluminacao_emergencia),
      row('Hidrante ou reserva d\'água', r.hidrante_reserva),
    ].join('')),
    section('Documentação Técnica', [
      row('Planta baixa / Croqui', r.planta_baixa),
      row('Sistema fixo de combate a incêndio', r.sistema_fixo_incendio),
    ].join('')),
    section('Resultado', [
      row('Observações', r.observacoes),
      row('Descrição Técnica', r.descricao_tecnica),
    ].join('')),
    section('Encaminhamento', [
      row('Órgão Destino', orgaos || null), row('Qual Órgão (Outro)', r.qual_orgao_outro),
      row('Situação do Imóvel', r.situacao_imovel), row('Reavaliação', r.reavaliacao),
    ].join('')),
    section('Vistoriador', [
      row('Nome', r.nome_vistoriador), row('Matrícula', r.matricula),
    ].join('')),
  ].join('');

  const protoSafe = sanitizeFileName(proto);
  await printAndShare(
    makeHtml(buildHeader(s, 'Laudo de Vistoria Técnica', proto), body, buildSignatures(s, 'Responsável pelo Estabelecimento')),
    {
      nomeArquivo: `vistoria_tecnica_${protoSafe}.pdf`,
      descricao: `Laudo de Vistoria Técnica — ${r.nome_estabelecimento || proto}`,
      pessoaId: r.sad_pessoa_id,
    },
  );
}

export async function exportRelatorioMensalPdf(data: {
  totalV: number;
  totalT: number;
  totalC: number;
  riscoAlto: number;
  sync: number;
  pendentes: number;
  tipoEntries: [string, number][];
  riscoEntries: { label: string; count: number }[];
  top5: [string, number][];
  mediaDiaria: string;
}): Promise<void> {
  const s = await getSettings();
  const now = new Date();
  const mesAno = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const mesAnoTitulo = mesAno.charAt(0).toUpperCase() + mesAno.slice(1);
  const dataGeracao = now.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const header = `<div class="header">
    <div class="header-title">${esc(s.nomeSecretaria || 'Secretaria Municipal')}</div>
    <div class="header-sub">${esc(s.municipioUF || '')}</div>
    <div class="header-doc">Relatório Mensal de Vistorias</div>
    <div class="header-meta"><span>Gerado em: ${dataGeracao}</span><span>Referência: ${esc(mesAnoTitulo)}</span></div>
  </div>`;

  const sr = (label: string, val: string | number) =>
    `<tr><td class="label">${esc(label)}</td><td class="value">${esc(String(val))}</td></tr>`;

  const resumo = section('Resumo Geral', [
    sr('Total de Vistorias', data.totalV),
    sr('Vistorias Técnicas', data.totalT),
    sr('Cadastros', data.totalC),
    sr('Risco Alto', data.riscoAlto),
    sr('Sincronizados', data.sync),
    sr('Pendentes', data.pendentes),
  ].join(''));

  const tipoRows = data.tipoEntries.length > 0
    ? data.tipoEntries.map(([tipo, count]) => sr(tipo, count)).join('')
    : `<tr><td colspan="2" class="value" style="text-align:center;padding:10px">Sem dados</td></tr>`;

  const riscoRows = data.riscoEntries.map(({ label, count }) =>
    `<tr><td class="label">${esc(label)}</td><td class="value">${count}</td></tr>`
  ).join('');

  const top5Rows = data.top5.length > 0
    ? data.top5.map(([bairro, count], i) => sr(`${i + 1}. ${bairro}`, `${count} ocorrências`)).join('')
    : `<tr><td colspan="2" class="value" style="text-align:center;padding:10px">Sem dados de bairro</td></tr>`;

  const body = [
    resumo,
    section('Vistorias por Tipo de Ocorrência', tipoRows),
    section('Vistorias por Nível de Risco', riscoRows),
    section('Top 5 Bairros com mais Ocorrências', top5Rows),
    section('Média Diária', sr('Vistorias por dia no mês', `${data.mediaDiaria} vis/dia`)),
  ].join('');

  const nome = esc(s.nomeVistoriador || '_________________________');
  const cargo = esc(s.cargo || 'Vistoriador');
  const sigs = `<div class="signatures" style="justify-content:center">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${nome}</div>
      <div class="sig-role">${cargo}</div>
    </div>
  </div>`;

  await printAndShare(
    makeHtml(header, body, sigs),
    {
      nomeArquivo: `relatorio_mensal_${mesAnoTitulo.replace(/ /g, '_')}.pdf`,
      descricao: `Relatório Mensal de Vistorias — ${mesAnoTitulo}`,
    },
  );
}

export async function exportCadastroPdf(r: any): Promise<void> {
  const s = await getSettings();
  const proto = r.id || '—';
  const gps = r.gpsLat ? `${Number(r.gpsLat).toFixed(6)}, ${Number(r.gpsLng).toFixed(6)}` : null;

  let nucleoHtml = '';
  if (r.nucleoFamiliar) {
    try {
      const ms: any[] = JSON.parse(r.nucleoFamiliar);
      if (ms.length > 0) {
        const rows = ms.map((m: any, i: number) => {
          const info = [
            m.parentesco,
            m.idade ? `${m.idade} anos` : null,
            m.genero === 'M' ? 'Masc.' : m.genero === 'F' ? 'Fem.' : null,
            m.cpf || null,
          ].filter(Boolean).join(' · ');
          return `<tr><td class="label">${i + 1}. ${esc(m.nome || '—')}</td><td class="value">${esc(info)}</td></tr>`;
        }).join('');
        nucleoHtml = section('Núcleo Familiar', rows);
      }
    } catch {}
  }

  const obsHtml = r.observacoes
    ? section('Observações', `<tr><td colspan="2" class="value" style="padding:8px 10px">${esc(String(r.observacoes)).replace(/\n/g, '<br>')}</td></tr>`)
    : '';

  const body = [
    section('Dados Pessoais', [
      row('Nome', r.nome), row('CPF', r.cpf), row('RG', r.rg),
      row('Data de Nascimento', r.dataNascimento),
      row('Idade', r.idade ? `${r.idade} anos` : null),
      row('Gênero', r.genero), row('Estado Civil', r.estadoCivil),
      row('Nacionalidade', r.nacionalidade), row('Naturalidade', r.naturalidade),
      row('Escolaridade', r.escolaridade), row('Profissão', r.profissao),
      row('Telefone', r.telefone), row('E-mail', r.email),
    ].join('')),
    section('Endereço', [
      row('Rua / Nº', r.endereco), row('Bairro', r.bairro), row('Cidade', r.municipio),
      row('CEP', r.cep), row('Ponto de Referência', r.pontoReferencia), row('GPS', gps),
    ].join('')),
    section('Dados da Família', [
      row('Nº Pessoas na Família', r.numPessoasFamilia),
      row('Responsável Familiar', r.responsavelFamiliar),
      row('Renda Familiar', r.rendaFamiliar), row('Programa Social', r.programaSocial),
    ].join('')),
    section('Moradia', [
      row('Tempo que mora no local', r.tempoMoraLocal), row('Nº de Cômodos', r.numComodos),
      row('Tipo de Moradia', r.tipoMoradia), row('Material de Construção', r.materialConstrucao),
      row('Qual material (Outro)', r.qualMaterialConstrucao),
      row('Possui Banheiro', r.possuiBanheiro), row('Obs. banheiro', r.obsBanheiro),
    ].join('')),
    section('Infraestrutura', [
      row('Água Potável', r.aguaPotavel), row('Obs. água', r.obsAguaPotavel),
      row('Energia Elétrica', r.energiaEletrica), row('Obs. energia', r.obsEnergiaEletrica),
      row('Saneamento Básico', r.saneamentoBasico), row('Obs. saneamento', r.obsSaneamentoBasico),
      row('Coleta de Lixo', r.coletaLixo), row('Obs. coleta', r.obsColetaLixo),
    ].join('')),
    section('Vulnerabilidade', [
      row('Área de Risco', r.areaRisco), row('Afetado por desastre', r.afetadoDesastre),
      row('Qual desastre', r.qualDesastre),
      row('Recebeu ajuda da Defesa Civil', r.ajudaDefesaCivil),
      row('Qual ajuda', r.qualAjudaDefesaCivil),
    ].join('')),
    section('Saúde', [
      row('Deficiência', r.deficiencia), row('Qual deficiência', r.qualDeficiencia),
      row('Doença crônica', r.doencaCronica), row('Qual doença', r.qualDoencaCronica),
      row('Medicamento contínuo', r.medicamentoContinuo), row('Qual medicamento', r.qualMedicamento),
    ].join('')),
    section('Documentação', [
      row('Documentos completos', r.documentosCompletos), row('Documentos faltantes', r.docsFaltantes),
    ].join('')),
    section('Assistência Imediata', [
      row('Necessita assistência imediata', r.assistenciaImediata), row('Prioridade', r.prioridade),
    ].join('')),
    nucleoHtml,
    obsHtml,
  ].join('');

  const nomeSafe = sanitizeFileName(r.nome?.replace(/ /g, '_') || proto);
  await printAndShare(
    makeHtml(buildHeader(s, 'Ficha de Cadastro', proto), body, buildSignatures(s, 'Responsável / Vistoriado')),
    {
      nomeArquivo: `cadastro_${nomeSafe}.pdf`,
      descricao: `Ficha de Cadastro — ${r.nome || proto}`,
      pessoaId: r.sad_pessoa_id,
    },
  );
}
