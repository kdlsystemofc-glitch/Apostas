import React, { useState } from "react";
import { poissonOver, sinalPoisson, calcularQuarterKelly } from "@/lib/predictionEngine";
import SignalBadge from "./SignalBadge";

export default function MarketBlock({ icon, title, homeName, awayName, xHome, xAway, xTotal, lines, sinalFn, warning }) {
  const [bookieOdd, setBookieOdd] = useState("");
  const useSinal = sinalFn || sinalPoisson;

  // Encontra a linha mais próxima do valor esperado para destacar como linha principal
  const closestLine = (lines && lines.length > 0 && xTotal != null)
    ? lines.reduce((a, b) => Math.abs(a - xTotal) < Math.abs(b - xTotal) ? a : b)
    : lines?.[0];

  const bestProb = closestLine != null ? poissonOver(xTotal, closestLine) : 0;
  const fairOdd = bestProb > 0 ? Math.max(1.01, Math.round((1 / bestProb) * 100) / 100) : "—";
  const bestSignal = useSinal(bestProb);

  const kelly = calcularQuarterKelly(bestProb, bookieOdd);
  const oddNum = parseFloat(bookieOdd);
  const hasBookieOdd = !isNaN(oddNum) && oddNum > 1.0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <h3 className="font-semibold tracking-tight text-sm sm:text-base truncate">{title}</h3>
        </div>
        {closestLine != null && (
          <span className="text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2.5 py-1 rounded-full">
            Linha Base: Over {closestLine}
          </span>
        )}
      </div>

      <div className="divide-y">
        {/* Box da Médias e Recomendação Principal */}
        <div className="grid grid-cols-3 text-center text-sm">
          <div className="px-3 py-3 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-xs text-muted-foreground mb-0.5 truncate font-medium">{homeName}</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{xHome ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-xs text-muted-foreground mb-0.5 truncate font-medium">{awayName}</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{xAway ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-blue-50/70 dark:bg-blue-950/40">
            <p className="text-xs text-blue-700 dark:text-blue-300 mb-0.5 truncate font-bold">Total Projetado</p>
            <p className="text-lg sm:text-xl font-extrabold text-blue-700 dark:text-blue-400">{xTotal}</p>
          </div>
        </div>

        {/* Highlight da Recomendação da Linha de Valor */}
        {closestLine != null && (
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block mb-0.5">
                🔥 Linha Comercial Recomendada
              </span>
              <p className="text-base font-extrabold text-white">
                Over {closestLine} {title}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-400 block">
                  {(bestProb * 100).toFixed(1)}%
                </span>
                <span className="text-[11px] text-slate-300 font-medium">
                  Odd Justa: <strong className="text-white">{fairOdd}</strong>
                </span>
              </div>
              <SignalBadge label={bestSignal.label} color={bestSignal.color} />
            </div>
          </div>
        )}

        {/* Calculador de EV+ Real Opcional & Quarter Kelly */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 flex flex-wrap items-center justify-between gap-2 text-xs border-b">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium">Comparar Odd da Casa:</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              placeholder="Ex: 1.85"
              value={bookieOdd}
              onChange={(e) => setBookieOdd(e.target.value)}
              className="w-20 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {hasBookieOdd && (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                kelly.isEVPlus ? "bg-emerald-600 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
              }`}>
                {kelly.isEVPlus ? `🔥 EV+ +${kelly.evPct.toFixed(1)}%` : `EV ${kelly.evPct.toFixed(1)}%`}
              </span>
              {kelly.isEVPlus && (
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                  Stake (Quarter-Kelly): {kelly.stakePct}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabela de Linhas Comerciais */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
            Linhas Comerciais Disponíveis (Odds Justas)
          </p>
          <div className="space-y-1.5">
            {lines?.map(line => {
              const prob = poissonOver(xTotal, line);
              const lineFairOdd = prob > 0 ? Math.max(1.01, Math.round((1 / prob) * 100) / 100) : "—";
              const sinal = useSinal(prob);
              const isClosest = line === closestLine;

              return (
                <div
                  key={line}
                  className={`flex items-center justify-between py-2 px-3.5 rounded-lg border transition-colors ${
                    isClosest
                      ? "bg-blue-50/80 border-blue-300 dark:bg-blue-950/30 dark:border-blue-700 shadow-sm"
                      : "bg-slate-50 border-slate-200/60 dark:bg-slate-900/30 dark:border-slate-800"
                  } hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Over {line}</span>
                    {isClosest && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                        {(prob * 100).toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-muted-foreground ml-2">
                        Odd Justa: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{lineFairOdd}</strong>
                      </span>
                    </div>
                    <SignalBadge label={sinal.label} color={sinal.color} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {warning && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200/60 dark:bg-amber-950/30 dark:border-amber-800">
          <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">{warning}</p>
        </div>
      )}
    </div>
  );
}