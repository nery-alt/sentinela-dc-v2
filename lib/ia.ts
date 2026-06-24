import { supabase } from './supabase';

// Chama a Edge Function "gerar-texto" no Supabase do sentinela-dc-v2.
// Recebe as anotações em grosso modo e devolve o texto técnico redigido.
export async function gerarTextoIA(
  fatos: string,
  tipo: 'descricao_tecnica' | 'observacoes' | 'recomendacoes',
  contexto: 'tecnica' | 'emergencia' = 'tecnica',
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('gerar-texto', {
    body: { fatos, tipo, contexto },
  });

  if (error) {
    // Tenta extrair a mensagem real da função, se houver
    let detalhe = error.message || 'falha na chamada';
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.text === 'function') {
        const corpo = await ctx.text();
        if (corpo) detalhe = corpo;
      }
    } catch {
      // ignora
    }
    throw new Error(detalhe);
  }

  if (data?.error) throw new Error(data.error);
  return String(data?.texto || '').trim();
}
