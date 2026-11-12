import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// gerar-texto v9 — IA compartilhada pelo aplicativo Sentinela DC e pelo SAD.
// v9: modos do Relatório Técnico de Vistoria (vistoria_objeto, vistoria_situacao, vistoria_recomendacoes, vistoria_conclusao).
// v8: texto vazio tenta o modelo reserva; caracterização ignora anotações; condições avisam conflitos.
// - Modos antigos (descricao_tecnica, recomendacoes, observacoes) continuam iguais para o aplicativo.
// - Modos novos do laudo de alvará (laudo_caracterizacao, laudo_condicoes, laudo_conclusao, laudo_legendas).
// - Modelo Haiku 5.5, com volta automática para o Haiku 4.5 se o 5.5 falhar.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const MODELOS = ["claude-haiku-5-5", "claude-haiku-4-5-20251001"];
const MAX_ENTRADA = 6000; // caracteres

// Navegadores só são aceitos vindos do SAD (o aplicativo não envia "Origin")
const ORIGENS_SAD = ["https://sad-web-omega.vercel.app", "http://localhost:5173"];

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ORIGENS_SAD.includes(origin) ? origin : ORIGENS_SAD[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resposta(corpo: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

// ---------------- Modos antigos (aplicativo) ----------------
const ALVO: Record<string, string> = {
  descricao_tecnica: "uma DESCRIÇÃO TÉCNICA do imóvel/estabelecimento e de suas condições",
  recomendacoes: "as RECOMENDAÇÕES técnicas pertinentes",
  observacoes: "as OBSERVAÇÕES técnicas",
};

function promptAntigo(tipo: string, contexto: string) {
  const alvo = ALVO[tipo] || "um texto técnico";
  const ctx = contexto === "emergencia"
    ? "uma vistoria de Defesa Civil em situação de risco/emergência"
    : contexto === "tecnica"
    ? "uma vistoria técnica de segurança contra incêndio e estabilidade estrutural para fins de alvará de funcionamento"
    : "uma vistoria técnica de Defesa Civil";
  return `Você é um técnico de Defesa Civil redigindo um LAUDO OFICIAL referente a ${ctx}.
Sua tarefa: transformar as anotações de campo (em linguagem informal ou abreviada) em ${alvo}, com redação técnica, formal e clara, em português do Brasil.

REGRAS ABSOLUTAS:
- Use SOMENTE os fatos fornecidos. NUNCA invente dados, medidas, normas, datas ou condições que não foram informados.
- Não acrescente conclusões que não decorram diretamente dos fatos dados.
- NUNCA comece com título, cabeçalho ou rótulo (ex: "DESCRIÇÃO TÉCNICA", "OBSERVAÇÕES"). Não use saudações nem preâmbulos. Responda SOMENTE com o texto corrido final, já pronto para colar no campo.
- Seja objetivo: de 2 a 6 frases, proporcional à quantidade de fatos informados.`;
}

// ---------------- Modos do laudo de alvará (SAD) ----------------
const ESTILO = `Você redige laudos da Secretaria Municipal de Defesa Civil e Patrimonial de Tefé (SEMDCEP), no "Relatório de Vistoria contra Incêndio e Estabilidade Estrutural para fins de Alvará".
Escreva em português do Brasil, linguagem técnica, formal, impessoal (terceira pessoa), frases completas, sem gírias, no mesmo estilo dos exemplos abaixo.

EXEMPLOS DO ESTILO DOS LAUDOS (imite o tom e a construção das frases):
- "Trata-se de estabelecimento comercial de pequeno porte destinado à atividade de distribuidora, instalado em edificação compatível com a atividade desenvolvida, com área total de 15 m² e capacidade estimada para 02 pessoas, apresentando baixo potencial de risco."
- "Durante a inspeção técnica verificou-se que o estabelecimento dispõe de **01 extintor de incêndio do tipo Pó Químico ABC**, instalado em local adequado, devidamente sinalizado e dentro do prazo de validade."
- "A edificação possui **sinalização de emergência**, saída de emergência desobstruída e rota de fuga compatível com as dimensões do imóvel, proporcionando condições adequadas para evacuação em caso de necessidade."
- "Foi constatada a existência de **iluminação de emergência** em funcionamento, contribuindo para a segurança dos ocupantes durante eventual interrupção do fornecimento de energia elétrica."
- "As instalações elétricas apresentaram condições satisfatórias, não sendo observadas irregularidades aparentes durante a vistoria. O estabelecimento não utiliza GLP, reduzindo os riscos associados à presença de gases inflamáveis."
- "Quanto à estabilidade estrutural, verificou-se que o imóvel apresenta boas condições de conservação, sem presença de trincas, fissuras ou qualquer anomalia estrutural aparente no momento da vistoria."

REGRAS ABSOLUTAS:
- Use SOMENTE os fatos do TEXTO BASE e das ANOTAÇÕES DA EQUIPE. NUNCA invente equipamentos, quantidades, medidas, normas, datas, problemas ou condições.
- NÃO mude o sentido de nenhum fato: o que está como "possui" continua "possui"; o que está como irregular continua irregular.
- NÃO emita parecer (favorável/desfavorável) e NÃO acrescente recomendações que não estejam no texto.
- SEMPRE devolva o texto completo, mesmo que não haja nada a mudar (nesse caso, devolva o texto base com a redação revisada).
- Mantenha o destaque em negrito com **asteriscos** nos itens principais, como nos exemplos.
- NUNCA escreva título, rótulo, saudação, explicação ou comentário. Responda SOMENTE com o texto final.`;

function promptLaudo(tipo: string) {
  if (tipo === "laudo_caracterizacao") {
    return `${ESTILO}

TAREFA: revise o parágrafo único de "CARACTERIZAÇÃO DO IMÓVEL". Ele descreve SOMENTE o estabelecimento (atividade, porte, edificação, área, capacidade, risco). NUNCA inclua equipamentos, irregularidades, extintores, instalações ou qualquer condição observada — isso pertence a outra seção. Responda com UM parágrafo, de 1 a 3 frases.`;
  }
  if (tipo === "laudo_condicoes") {
    return `${ESTILO}

TAREFA: reescreva a seção "CONDIÇÕES OBSERVADAS NA VISTORIA". Cada parágrafo do texto base trata de um item; mantenha um parágrafo por item, na mesma ordem, e incorpore as anotações da equipe no parágrafo do item a que se referem (ou em um parágrafo novo, se for um item que ainda não aparece). Separe os parágrafos com UMA linha em branco. Não use listas nem marcadores.

CONFLITOS: o texto base vem do checklist marcado pelo vistoriador. Se uma anotação CONTRADISSER o texto base (exemplo: o texto diz "instalado em local adequado" e a anotação diz "extintor fora da altura" ou "fora do local"), NÃO junte as duas informações e NÃO altere o fato do texto base: mantenha o parágrafo como está e registre o conflito.
Anotações que são recomendações ou exigências (ex.: "instalar", "adequar", "providenciar") NÃO entram no texto; registre-as também como conflito/observação.

FORMATO DA RESPOSTA: primeiro o texto final. Se houver conflitos, depois do texto escreva uma linha contendo exatamente ### CONFLITOS e, abaixo dela, um conflito por linha, curto, em português simples (ex.: "Anotação diz que o extintor está fora da altura padrão, mas o checklist marca 'em local adequado'."). Se não houver conflitos, NÃO escreva a linha ### CONFLITOS.`;
  }
  if (tipo === "laudo_conclusao") {
    return `${ESTILO}

TAREFA: revise o parágrafo de "CONCLUSÃO TÉCNICA" apenas na redação (clareza, concordância, pontuação). Mantenha exatamente a mesma conclusão. Responda com UM parágrafo.`;
  }
  // laudo_legendas
  return `Você corrige legendas de fotos de um laudo oficial da Defesa Civil de Tefé.
TAREFA: corrija ortografia, acentuação e concordância de cada legenda, com a primeira letra maiúscula e ponto final. NÃO mude o sentido, NÃO acrescente informação, NÃO numere.
Responda com UMA legenda por linha, na MESMA ordem e na MESMA quantidade de linhas recebidas, sem nenhum outro texto.`;
}

function mensagemLaudo(tipo: string, base: string, anotacoes: string) {
  if (tipo === "laudo_legendas") return `Legendas:\n${base}`;
  return `TEXTO BASE (gerado a partir do checklist da vistoria):\n${base || "(vazio)"}\n\nANOTAÇÕES DA EQUIPE EM CAMPO:\n${anotacoes || "(nenhuma)"}`;
}


// ---------------- Modos do Relatório Técnico de Vistoria (SAD) ----------------
const ESTILO_VISTORIA = `Você redige o "Relatório Técnico de Vistoria" da Secretaria Municipal de Defesa Civil e Patrimonial de Tefé (SEMDCEP), Amazonas.
Escreva em português do Brasil, linguagem técnica, formal, impessoal (terceira pessoa), frases completas e objetivas, sem gírias, no mesmo estilo dos exemplos abaixo (tirados de relatórios reais da equipe).

EXEMPLOS DO ESTILO (imite o tom e a construção das frases):
- OBJETO: "O presente Relatório Técnico de Vistoria tem por finalidade avaliar as condições de segurança de um muro localizado em imóvel residencial na Rua Espírito Santo, nº 1319, bairro São João, que apresenta inclinação acentuada, associada ao escoamento e à infiltração de águas provenientes de imóvel vizinho."
- OBJETO: "O presente Relatório Técnico de Vistoria tem por finalidade registrar os danos ocasionados por incêndio em imóvel residencial localizado na Comunidade Cairara, Lago do Caiambé, zona rural de Tefé/AM, bem como subsidiar os encaminhamentos necessários ao atendimento da família atingida."
- SITUAÇÃO: "Durante a vistoria, foi identificada inclinação acentuada do muro, indicando comprometimento de sua estabilidade e possibilidade de tombamento, com risco à segurança dos moradores e de pessoas que circulam nas proximidades."
- SITUAÇÃO: "Foi registrada a ocorrência de escoamento contínuo de águas provenientes de caixas de armazenamento instaladas no imóvel vizinho, lançadas diretamente sobre o terreno, favorecendo a infiltração e o comprometimento das condições de sustentação do muro."
- SITUAÇÃO: "O incêndio afetou diretamente 01 família composta por 07 pessoas, todas registradas como desabrigadas, em razão da perda da residência e de seus bens essenciais."
- RECOMENDAÇÃO: "Encaminhamento à Secretaria Municipal de Infraestrutura e Obras – SEMIO, para avaliação das condições do muro e adoção das providências técnicas cabíveis, incluindo avaliação por profissional habilitado quanto à necessidade de recuperação, reforço ou reconstrução da estrutura."
- RECOMENDAÇÃO: "Isolamento preventivo da área próxima ao muro, evitando a permanência e circulação de pessoas na zona sujeita a eventual tombamento, até que sejam avaliadas e corrigidas as condições de segurança."
- CONCLUSÃO: "A vistoria identificou inclinação acentuada do muro, com possibilidade de tombamento, associada à ocorrência de escoamento e infiltração de águas provenientes do imóvel vizinho, condições que podem contribuir para o agravamento da instabilidade da estrutura."
- CONCLUSÃO: "Dessa forma, recomenda-se o encaminhamento do presente relatório à SEMIO, para conhecimento, avaliação técnica e providências de sua competência, visando à redução dos riscos identificados e à segurança dos moradores."

REGRAS ABSOLUTAS:
- Use SOMENTE os fatos do TEXTO BASE e das ANOTAÇÕES DA EQUIPE. NUNCA invente danos, medidas, quantidades, pessoas, causas, normas, datas ou órgãos.
- NÃO mude o sentido de nenhum fato. Números de pessoas e famílias ficam exatamente como informados (com dois dígitos: 01, 04, 07).
- Nomes de órgãos e siglas ficam EXATAMENTE como no texto base (ex.: "SEMIO", "SEMASC", "SEMMALP"); nunca troque uma sigla por outra.
- SEMPRE devolva o texto completo, mesmo que não haja nada a mudar.
- NUNCA escreva título, rótulo, numeração de seção, saudação, explicação ou comentário. Responda SOMENTE com o texto final.`;

const TAREFA_VISTORIA: Record<string, string> = {
  vistoria_objeto: `TAREFA: revise o parágrafo de "OBJETO": diz o que foi vistoriado, onde e para quê. Use as anotações só para precisar o que foi vistoriado (sem descrever danos em detalhe — isso é da seção seguinte). Responda com UM parágrafo, de 1 a 2 frases, começando por "O presente Relatório Técnico de Vistoria tem por finalidade".`,
  vistoria_situacao: `TAREFA: escreva a seção "SITUAÇÃO CONSTATADA E ANÁLISE" a partir do texto base e das anotações da equipe: o que foi constatado em campo, os danos, as pessoas afetadas e a análise do risco que decorre DIRETAMENTE desses fatos. De 2 a 5 parágrafos curtos, separados por UMA linha em branco. Não use listas. Não escreva recomendações nem encaminhamentos.

CONFLITOS: se uma anotação contradisser o texto base, mantenha o texto base e registre o conflito. FORMATO: primeiro o texto; se houver conflitos, depois uma linha com exatamente ### CONFLITOS e um conflito por linha, em português simples. Se não houver, NÃO escreva essa linha.`,
  vistoria_recomendacoes: `TAREFA: revise a lista de "RECOMENDAÇÕES". Cada linha do texto base é um item; mantenha EXATAMENTE os mesmos itens, na mesma ordem e na mesma quantidade, reescrevendo cada um em uma frase técnica completa no estilo dos exemplos. Você pode tornar a finalidade de cada encaminhamento mais específica usando os fatos das anotações (ex.: "para avaliação das condições do muro"), mas NUNCA acrescente item, órgão ou medida novos.
Responda com UM item por linha, começando cada linha pelo número e ponto ("1. ", "2. "...), sem nenhum outro texto.`,
  vistoria_conclusao: `TAREFA: revise a "CONCLUSÃO": um parágrafo que resume o que a vistoria constatou e o risco (use as anotações para isso, sem inventar), e um parágrafo final com o encaminhamento, mantendo EXATAMENTE os mesmos órgãos do texto base. Separe os parágrafos com UMA linha em branco.`,
};

async function chamarIA(system: string, conteudo: string, maxTokens: number) {
  let ultimoErro = "";
  for (const modelo of MODELOS) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: conteudo }],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const texto = (data.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("\n")
        .trim();
      if (texto) {
        console.log("gerar-texto: respondeu", modelo);
        return texto;
      }
      ultimoErro = `${modelo}: resposta vazia (stop_reason=${data.stop_reason})`;
      console.error("gerar-texto:", ultimoErro);
      continue;
    }
    ultimoErro = `${modelo}: ${resp.status} ${await resp.text()}`;
    console.error("gerar-texto: falha no modelo", ultimoErro);
    // erro de autenticação ou de limite não melhora trocando de modelo
    if (resp.status === 401 || resp.status === 403 || resp.status === 429) break;
  }
  throw new Error(ultimoErro);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

  // Navegador de fora do SAD: recusado. (O aplicativo não envia Origin.)
  if (origin && !ORIGENS_SAD.includes(origin)) {
    return resposta({ error: "Origem não autorizada." }, 403, origin);
  }

  try {
    const corpo = await req.json();
    const tipo = String(corpo.tipo || "");

    // ---- Laudo de alvará (SAD) ----
    if (tipo.startsWith("laudo_")) {
      if (!["laudo_caracterizacao", "laudo_condicoes", "laudo_conclusao", "laudo_legendas"].includes(tipo)) {
        return resposta({ error: "Tipo inválido." }, 400, origin);
      }
      const base = String(corpo.base || "").trim();
      const anotacoes = String(corpo.anotacoes || "").trim();
      if (!base && !anotacoes) return resposta({ error: "Sem texto para redigir." }, 400, origin);
      if (base.length + anotacoes.length > MAX_ENTRADA) return resposta({ error: "Texto muito longo." }, 400, origin);
      const anot = tipo === "laudo_caracterizacao" ? "" : anotacoes; // caracterização não usa anotações
      const bruto = await chamarIA(promptLaudo(tipo), mensagemLaudo(tipo, base, anot), tipo === "laudo_condicoes" ? 1800 : 700);
      const [parteTexto, parteConflitos = ""] = bruto.split(/^\s*#{2,}\s*CONFLITOS\s*$/m);
      const conflitos = parteConflitos.split("\n").map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
      const texto = parteTexto.trim();
      if (!texto) return resposta({ error: "A IA não devolveu texto. Tente de novo." }, 502, origin);
      return resposta({ texto, conflitos }, 200, origin);
    }

    // ---- Relatório Técnico de Vistoria (SAD) ----
    if (tipo.startsWith("vistoria_")) {
      const tarefa = TAREFA_VISTORIA[tipo];
      if (!tarefa) return resposta({ error: "Tipo inválido." }, 400, origin);
      const base = String(corpo.base || "").trim();
      const anotacoes = String(corpo.anotacoes || "").trim();
      if (!base && !anotacoes) return resposta({ error: "Sem texto para redigir." }, 400, origin);
      if (base.length + anotacoes.length > MAX_ENTRADA) return resposta({ error: "Texto muito longo." }, 400, origin);
      const bruto = await chamarIA(`${ESTILO_VISTORIA}\n\n${tarefa}`,
        `TEXTO BASE:\n${base || "(vazio)"}\n\nANOTAÇÕES DA EQUIPE EM CAMPO:\n${anotacoes || "(nenhuma)"}`,
        tipo === "vistoria_situacao" ? 1800 : 1000);
      const [parteTexto, parteConflitos = ""] = bruto.split(/^\s*#{2,}\s*CONFLITOS\s*$/m);
      const conflitos = parteConflitos.split("\n").map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
      const texto = parteTexto.trim();
      if (!texto) return resposta({ error: "A IA não devolveu texto. Tente de novo." }, 502, origin);
      return resposta({ texto, conflitos }, 200, origin);
    }

    // ---- Modos antigos (aplicativo) ----
    const fatos = String(corpo.fatos || "").trim();
    if (!fatos) return resposta({ error: "Sem anotações para redigir." }, 400, origin);
    if (fatos.length > MAX_ENTRADA) return resposta({ error: "Texto muito longo." }, 400, origin);
    const texto = await chamarIA(promptAntigo(tipo, String(corpo.contexto || "geral")), `Anotações de campo:\n${fatos}`, 700);
    return resposta({ texto }, 200, origin);
  } catch (err) {
    console.error("gerar-texto: erro", String(err));
    return resposta({ error: "A IA não respondeu agora. Tente de novo em instantes." }, 502, origin);
  }
});
