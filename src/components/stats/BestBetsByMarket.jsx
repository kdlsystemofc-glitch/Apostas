import React from "react";
import { poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS, COMMERCIAL_LINES } from "@/lib/predictionEngine";

const colorClasses = {
  green:  "bg-emerald-500 text-white",
  yellow: "bg-amber-400 text-amber-950",
  red:    "bg-red-500 text-white",
  gray:   "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200",
};

function bestCommercialLine(xTotal, lines, sinalFn = sinalPoisson) {
  if (!lines || lines.length === 0 || xTotal == null) return null;

  // Seleciona a linha comercial mais próxima do valor esperado do modelo
  const linhaPrincipal = lines.reduce((a, b) => Math.abs(a - xTotal) < Math.abs(b - xTotal) ? a : b);
  const prob = poissonOver(xTotal, linhaPrincipal);
  const oddMinima = prob > 0 ? Math.max(1.01, Math.round((1 / prob) * 100) / 100) : "—";
  const sinal = sinalFn(prob);

  return {
    linha: linhaPrincipal,
    prob,
    oddMinima,
    sinal,
    strength: Math.abs(prob - 0.5),
  };
}

export default function BestBetsByMarket({ match }) {
  const r = match.results;
  if (!r) return null;

  const mercados = [
    { icon: "🔲", label: "Escanteios Total", x: r.xc_total, lines: COMMERCIAL_LINES.corners_total },
    { icon: "🔲", label: `Escanteios ${match.home_team}`, x: r.xc_casa, lines: COMMERCIAL_LINES.corners_team },
    { icon: "🔲", label: `Escanteios ${match.away_team}`, x: r.xc_fora, lines: COMMERCIAL_LINES.corners_team },
    { icon: "⚽", label: "Gols Total", x: r.xg_total, lines: COMMERCIAL_LINES.goals_total, sinalFn: sinalPoissonGols },
    { icon: "⚽", label: `Gols ${match.home_team}`, x: r.xg_casa, lines: COMMERCIAL_LINES.goals_team, sinalFn: sinalPoissonGols },
    { icon: "⚽", label: `Gols ${match.away_team}`, x: r.xg_fora, lines: COMMERCIAL_LINES.goals_team, sinalFn: sinalPoissonGols },
    { icon: "🎯", label: "Chutes no Gol Total", x: r.xs_total, lines: COMMERCIAL_LINES.shots_target_total },
    { icon: "🎯", label: `Chutes no Gol ${match.home_team}`, x: r.xs_casa, lines: COMMERCIAL_LINES.shots_target_team },
    { icon: "🎯", label: `Chutes no Gol ${match.away_team}`, x: r.xs_fora, lines: COMMERCIAL_LINES.shots_target_team },
    { icon: "💥", label: "Chutes Totais", x: r.xtotalshots_total, lines: COMMERCIAL_LINES.total_shots_total, lowConfidence: true },
    { icon: "🟨", label: "Cartões Total", x: r.xcard_total, lines: COMMERCIAL_LINES.cards_total },
    { icon: "🟨", label: `Cartões ${match.home_team}`, x: r.xcard_casa, lines: COMMERCIAL_LINES.cards_team },
    { icon: "🟨", label: `Cartões ${match.away_team}`, x: r.xcard_fora, lines: COMMERCIAL_LINES.cards_team },
    { icon: "🧤", label: "Defesas Goleiro Total", x: r.xsaves_total, lines: COMMERCIAL_LINES.saves_total },
    { icon: "🧤", label: `Defesas Goleiro ${match.home_team}`, x: r.xsaves_casa, lines: COMMERCIAL_LINES.saves_team },
    { icon: "🧤", label: `Defesas Goleiro ${match.away_team}`, x: r.xsaves_fora, lines: COMMERCIAL_LINES.saves_team },
    { icon: "🤜", label: "Faltas Total", x: r.xfouls_total, lines: COMMERCIAL_LINES.fouls_total, variance: true },
  ];

  const rows = mercados
    .filter(m => m.x != null && m.x > 0)
    .map(m => {
      const best = bestCommercialLine(m.x, m.lines, m.sinalFn || sinalPoisson);
      return { ...m, best };
    })
    .filter(m => m.best != null);

  const sorted = [...rows].sort((a, b) => b.best.strength - a.best.strength);
  const bttsSinal = sinalBTTS(r.p_btts);
  const bttsOddMin = r.p_btts > 0 ? Math.max(1.01, Math.round((1 / r.p_btts) * 100) / 100) : "—";
  const allNeutral = sorted.length > 0 && sorted.every(m => m.best.sinal.label === "NEUTRO");

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-slate-900 border-b flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white flex items-center gap-2 text-base">
            🔥 Melhores Apostas Comerciais por Mercado
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Linhas comerciais reais da Bet365/Pinnacle · Ordenado por força do sinal e Odd Mínima Justa
          </p>
        </div>
      </div>

      <div className="divide-y">
        {/* Mercado 1X2 Em Destaque na Tabela de Melhores Apostas */}
        {r.pick_1x2 && (
          <div className="flex items-center justify-between px-5 py-3 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-300 leading-tight">
                  Resultado 1X2 — {r.pick_1x2.resultado}
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                  Pick Estrita do Modelo (Vitória/Empate)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {(r.pick_1x2.prob * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  Odd Min: <strong className="text-emerald-600 font-bold">{r.pick_1x2.odd_minima}</strong>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-600 text-white">
                RECOMENDADO
              </span>
            </div>
          </div>
        )}

        {sorted.map(({ icon, label, x, best, variance, lowConfidence }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="text-sm font-medium leading-tight">
                  {label}
                  {variance && (
                    <span className="ml-1.5 text-[10px] text-amber-500 font-normal">alta variância</span>
                  )}
                  {lowConfidence && (
                    <span className="ml-1.5 text-[10px] text-red-500 font-normal">
                      em recalibração — baixa confiabilidade
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Projeção: {x?.toFixed(2)} · Linha Comercial: Over {best.linha}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-sm font-bold tabular-nums">
                  {(best.prob * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground ml-2">
                  Odd Min: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{best.oddMinima}</strong>
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClasses[best.sinal.color]}`}>
                {best.sinal.label}
              </span>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔁</span>
            <div>
              <p className="text-sm font-medium">Ambas Marcam (BTTS)</p>
              <p className="text-xs text-muted-foreground">
                P(Casa marca): {r.db?.p_casa_marca != null ? (r.db.p_casa_marca * 100).toFixed(1) : "—"}% ·
                P(Fora marca): {r.db?.p_fora_marca != null ? (r.db.p_fora_marca * 100).toFixed(1) : "—"}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <span className="text-sm font-bold tabular-nums">
                {(r.p_btts * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                Odd Min: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{bttsOddMin}</strong>
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClasses[bttsSinal.color]}`}>
              {bttsSinal.label}
            </span>
          </div>
        </div>
      </div>

      {allNeutral ? (
        <div className="px-5 py-4 text-center bg-slate-50 dark:bg-slate-900 border-t">
          <p className="text-sm text-muted-foreground font-medium">
            Sem sinais fortes para este jogo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os mercados estão na zona neutra (40-60%). Considere não apostar neste jogo.
          </p>
        </div>
      ) : (
        sorted[0]?.best.sinal.label !== "NEUTRO" && (
          <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-100 dark:border-emerald-900 flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              🏆 Sinal mais forte do mercado:
            </span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-200">
              {sorted[0].label} · Over {sorted[0].best.linha} · {(sorted[0].best.prob * 100).toFixed(1)}% (Odd Min: {sorted[0].best.oddMinima})
            </span>
          </div>
        )
      )}
    </div>
  );
}