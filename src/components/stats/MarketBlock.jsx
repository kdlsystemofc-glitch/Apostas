import React, { useState } from "react";
import { poissonOver, sinalPoisson, calcularQuarterKelly } from "@/lib/predictionEngine";
import { useBankrollStore } from "@/store/useBankrollStore";
import SignalBadge from "./SignalBadge";

export default function MarketBlock({ icon, title, homeName, awayName, xHome, xAway, xTotal, lines, sinalFn, warning }) {
  const [bookieOdd, setBookieOdd] = useState("");
  const { calculateStakeAmount } = useBankrollStore();
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
  const stakeReais = hasBookieOdd && kelly.isEVPlus ? calculateStakeAmount(kelly.stakePct) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Header do Mercado */}
      <div className="px-5 py-3 bg-slate-950 text-white flex items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <h3 className="font-semibold tracking-tight text-sm sm:text-base truncate text-slate-100">{title}</h3>
        </div>
        {closestLine != null && (
          <span className="text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full">
            Linha Base: Over {closestLine}
          </span>
        )}
      </div>

      <div className="divide-y divide-slate-800/60">
        {/* Box da Médias e Recomendação Principal */}
        <div className="grid grid-cols-3 text-center text-sm">
          <div className="px-3 py-3 bg-slate-950/40">
            <p className="text-xs text-slate-400 mb-0.5 truncate font-semibold">{homeName}</p>
            <p className="text-lg sm:text-xl font-bold text-white tabular-nums">{xHome ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-slate-950/40">
            <p className="text-xs text-slate-400 mb-0.5 truncate font-semibold">{awayName}</p>
            <p className="text-lg sm:text-xl font-bold text-white tabular-nums">{xAway ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-blue-950/30">
            <p className="text-xs text-blue-400 mb-0.5 truncate font-bold">Total Projetado</p>
            <p className="text-lg sm:text-xl font-extrabold text-blue-400 tabular-nums">{xTotal}</p>
          </div>
        </div>

        {/* Highlight da Recomendação da Linha de Valor */}
        {closestLine != null && (
          <div className="p-4 bg-slate-950/90 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-y border-slate-800">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-0.5">
                🔥 Linha Comercial Recomendada
              </span>
              <p className="text-base font-extrabold text-white">
                Over {closestLine} {title}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right tabular-nums">
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

        {/* Calculador de EV+ Real & Stake em R$ */}
        <div className="px-4 py-2.5 bg-slate-950/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">Odd da Casa:</span>
            <input
              type="number"
              step="0.01"
              min="1.01"
              placeholder="Ex: 1.85"
              value={bookieOdd}
              onChange={(e) => setBookieOdd(e.target.value)}
              className="w-20 px-2 py-0.5 rounded border border-slate-700 bg-slate-950 text-white font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {hasBookieOdd && (
            <div className="flex items-center gap-2 tabular-nums">
              <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                kelly.isEVPlus ? "bg-emerald-600 text-white" : "bg-rose-950 text-rose-300 border border-rose-800"
              }`}>
                {kelly.isEVPlus ? `🔥 EV+ +${kelly.evPct.toFixed(1)}%` : `EV ${kelly.evPct.toFixed(1)}%`}
              </span>
              {kelly.isEVPlus && (
                <span className="font-bold text-emerald-400 text-[11px] bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Stake: <strong>{kelly.stakePct}%</strong> ({`R$ ${stakeReais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tabela de Linhas Comerciais */}
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
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
                      ? "bg-blue-950/40 border-blue-700/60 shadow-sm"
                      : "bg-slate-950/40 border-slate-800"
                  } hover:bg-slate-800/40`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-100">Over {line}</span>
                    {isClosest && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase">
                        Principal
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <div className="text-right">
                      <span className="text-xs font-bold text-white">
                        {(prob * 100).toFixed(1)}%
                      </span>
                      <span className="text-[11px] text-slate-400 ml-2">
                        Odd Justa: <strong className="text-emerald-400 font-bold">{lineFairOdd}</strong>
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
        <div className="px-4 py-2 bg-amber-950/40 border-t border-amber-800/60">
          <p className="text-xs text-amber-300 font-semibold">{warning}</p>
        </div>
      )}
    </div>
  );
}