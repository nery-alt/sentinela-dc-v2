// Ajudantes de texto para as telas que falam com o SAD.
// Funções puras: nunca lançam erro.

// "João Ofício" -> "joao oficio" (para comparar sem acento e sem maiúscula)
export function semAcento(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Filtro de listas em memória: igual ao `campo?.toLowerCase().includes(busca.toLowerCase())` de antes,
// mas ignorando acento. Campo nulo/ausente continua não batendo (como antes).
export function contemSemAcento(campo: unknown, busca: string): boolean {
  return campo != null && semAcento(campo).includes(semAcento(busca));
}

// Traduz o erro de uma busca/envio ao SAD numa mensagem clara em português.
// `salvo` é o complemento sobre o que continua guardado no celular (ex.: "Sua vistoria continua salva no celular.").
// Se o erro não for de conexão nem de login, devolve null e a tela mantém a mensagem que já mostrava.
export function mensagemErroSAD(e: unknown, salvo = 'Sua vistoria continua salva no celular.'): string | null {
  const err = (e ?? {}) as { message?: string; name?: string };
  const msg = String(err.message || e || '');
  const baixo = msg.toLowerCase();
  // Só o código HTTP ("SAD respondeu 401", "Foto 2: 403 ..."), nunca um número de protocolo como "401/2026".
  if (/(?:respondeu|sad|:)\s*40[13]\b(?!\s*\/)/i.test(msg) || baixo.includes('jwt') || baixo.includes('permission denied')) {
    return `Você não está conectado ao SAD (ou a conexão venceu). Abra Configurações → Conexão com o SAD → Conectar e tente de novo.${salvo ? ` ${salvo}` : ''}`;
  }
  if (baixo.includes('network request failed') || baixo.includes('failed to fetch') || baixo.includes('network') || err.name === 'AbortError') {
    return salvo ? `Sem internet. ${salvo.replace(/\.$/, '')}; envie quando tiver sinal.` : 'Sem internet. Tente de novo quando tiver sinal.';
  }
  return null;
}
