import React, { useState } from "react";
import { calcularQuarterKelly } from "@/lib/predictionEngine";

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

  // Gestão de Risco e Stake via Quarter-Kelly
  const kelly = calcularQuarterKelly(pick.prob, bookieOdd);
  const oddNum = parseFloat(bookieOdd);
  const hasBookieOdd = !isNaN(oddNum) && oddNum > 1.0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-base">
          🏆 Resultado Esperado (1X2)
        </h3>
        <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">
          Dixon-Coles V2 Model
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
              {hasBookieOdd && (
                <div className={`text-xs font-extrabold px-3 py-1.5 rounded-lg border ${
                  kelly.isEVPlus
                    ? "bg-emerald-600 text-white border-emerald-700 shadow-sm"
                    : "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-200"
                }`}>
                  {kelly.isEVPlus ? `🔥 EV+ +${kelly.evPct.toFixed(1)}%` : `EV ${kelly.evPct.toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>

          {/* Campo Opcional para Inserção da Odd da Casa e Sugestão Quarter-Kelly */}
          <div className="mt-3.5 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
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
            </div>
            {hasBookieOdd && (
              <div className="flex items-center gap-2">
                {kelly.isEVPlus ? (
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2.5 py-1 rounded border border-emerald-300">
                    💰 Stake Recomendada (Quarter-Kelly): <strong>{kelly.stakePct}% da Banca</strong>
                  </span>
                ) : (
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    Sem Valor Esperado positivo frente à Odd informada
                  </span>
                )}
              </div>
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

        {/* Handicaps e Placares Prováveis */}
        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          {/* Handicaps Derivados */}
          {r.handicaps && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                Handicaps Asiáticos Derivados
              </p>
              <div className="space-y-1.5 text-xs font-medium">
                <div className="flex justify-between">
                  <span>DNB (AH 0.0) {home}:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {(r.handicaps.dnb_home * 100).toFixed(1)}% (Odd {(1 / r.handicaps.dnb_home).toFixed(2)})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>DNB (AH 0.0) {away}:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {(r.handicaps.dnb_away * 100).toFixed(1)}% (Odd {(1 / r.handicaps.dnb_away).toFixed(2)})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>AH -1.5 {home}:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    {(r.handicaps.ah_minus_15_home * 100).toFixed(1)}%
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Placares Mais Prováveis */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Top 5 Placares Mais Prováveis
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {r.placares_top5?.map((p, i) => (
                <div key={i} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-1.5 text-center border">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{p.placar}</p>
                  <p className="text-[11px] text-muted-foreground font-medium">{(p.prob * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
