import React, { useState } from "react";

export default function MatchResultBlock({ match }) {
  const [bookieOdd, setBookieOdd] = useState("");
  const r = match.results;
  if (!r?.p_casa_vence) return null;

  const home = match.home_team;
  const away = match.away_team;
  const barWidth = (p) => `${Math.round(p * 100)}%`;

  // Identificação do palpite estrito (Vitória Casa, Empate, Vitória Fora)
  const pick = r.pick_1x2 || (() => {
    if (r.p_empate > r.p_casa_vence && r.p_empate > r.p_fora_vence) {
      return { resultado: "Empate", prob: r.p_empate, odd_minima: (1 / r.p_empate).toFixed(2) };
    }
    if (r.p_fora_vence > r.p_casa_vence && r.p_fora_vence > r.p_empate) {
      return { resultado: `Vitória ${away}`, prob: r.p_fora_vence, odd_minima: (1 / r.p_fora_vence).toFixed(2) };
    }
    return { resultado: `Vitória ${home}`, prob: r.p_casa_vence, odd_minima: (1 / r.p_casa_vence).toFixed(2) };
  })();

  const pickTitle = pick.resultado === "Vitória Casa" ? `Vitória ${home}` : pick.resultado === "Vitória Fora" ? `Vitória ${away}` : pick.resultado;

  // Cálculo do Expected Value (EV+) Real quando o usuário informa a Odd da Casa de Apostas
  const oddNum = parseFloat(bookieOdd);
  const hasBookieOdd = !isNaN(oddNum) && oddNum > 1.0;
  const realEV = hasBookieOdd ? ((pick.prob * oddNum) - 1) * 100 : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-base">
          🏆 Resultado Esperado (1X2)
        </h3>
        <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">
          Dixon-Coles Model
        </span>
      </div>

      <div className="p-5 space-y-5">
        {/* Box da Pick do Modelo (Assumindo a Responsabilidade) */}
        <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-50/50 p-4 dark:bg-emerald-950/20 dark:border-emerald-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              🎯 Pick Principal do Modelo
            </span>
            <span className="text-xs font-bold bg-emerald-600 text-white px-2 py-0.5 rounded">
              {(pick.prob * 100).toFixed(1)}% Confiança
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {pickTitle}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border shadow-sm">
                Odd Justa (Fair Odd): <span className="text-emerald-600 font-extrabold">{pick.odd_minima}</span>
              </div>
              {hasBookieOdd && realEV !== null && (
                <div className={`text-xs font-extrabold px-3 py-1.5 rounded-lg border ${
                  realEV > 0
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                    : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200"
                }`}>
                  {realEV > 0 ? `🔥 EV+ +${realEV.toFixed(1)}%` : `EV ${realEV.toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>

          {/* Campo Opcional para Inserção da Odd da Casa (Calculador EV+ Real) */}
          <div className="mt-3.5 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium whitespace-nowrap">Odd da Casa (Bet365 / Pinnacle):</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              placeholder="Ex: 2.10"
              value={bookieOdd}
              onChange={(e) => setBookieOdd(e.target.value)}
              className="w-24 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {hasBookieOdd && (
              <span className="text-[11px] text-muted-foreground ml-1">
                {realEV > 0 ? "✓ Aposta de Valor Esperado Positivo!" : "✗ Sem Valor Esperado frente à Odd informada"}
              </span>
            )}
          </div>
        </div>

        {/* Barra Visual de Probabilidades (1X2) */}
        <div className="space-y-2">
          <div className="flex rounded-full overflow-hidden h-9 text-xs font-bold shadow-inner">
            <div className="bg-emerald-500 text-white flex items-center justify-center transition-all"
                 style={{ width: barWidth(r.p_casa_vence) }}>
              {(r.p_casa_vence * 100).toFixed(1)}%
            </div>
            <div className="bg-amber-500 text-white flex items-center justify-center transition-all"
                 style={{ width: barWidth(r.p_empate) }}>
              {(r.p_empate * 100).toFixed(1)}%
            </div>
            <div className="bg-rose-500 text-white flex items-center justify-center transition-all"
                 style={{ width: barWidth(r.p_fora_vence) }}>
              {(r.p_fora_vence * 100).toFixed(1)}%
            </div>
          </div>
          <div className="flex justify-between text-xs font-semibold px-1">
            <span className="text-emerald-700 dark:text-emerald-400">Mandante: {home}</span>
            <span className="text-amber-700 dark:text-amber-400">Empate</span>
            <span className="text-rose-700 dark:text-rose-400">Visitante: {away}</span>
          </div>
        </div>

        {/* Placares Mais Prováveis */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Top 5 Placares Mais Prováveis
          </p>
          <div className="grid grid-cols-5 gap-2">
            {r.placares_top5?.map((p, i) => (
              <div key={i} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-center border">
                <p className="text-base font-bold text-slate-900 dark:text-white">{p.placar}</p>
                <p className="text-xs text-muted-foreground font-medium">{(p.prob * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
