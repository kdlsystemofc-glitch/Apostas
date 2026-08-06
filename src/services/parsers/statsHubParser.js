import { parseStatsHubText } from "@/lib/predictionEngine";

/**
 * Parser de Ingestão de Estatísticas com Diagnóstico de Erros
 */
export function parseStatsHubInput(rawText) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return {
      success: false,
      data: null,
      error: "O texto colar está vazio ou é inválido.",
    };
  }

  try {
    const stats = parseStatsHubText(rawText);
    const parsedKeys = Object.keys(stats);

    if (parsedKeys.length === 0) {
      return {
        success: false,
        data: null,
        error: "Nenhuma estatística reconhecida no formato colado. Verifique se copiou a tabela completa do StatsHub.",
      };
    }

    return {
      success: true,
      data: stats,
      parsedCount: parsedKeys.length,
      error: null,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      error: `Erro ao processar tabela: ${err.message}`,
    };
  }
}
