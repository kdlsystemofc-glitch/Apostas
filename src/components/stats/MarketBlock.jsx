import React from "react";
import { poissonOver, sinalPoisson } from "@/lib/predictionEngine";
import SignalBadge from "./SignalBadge";

export default function MarketBlock({ icon, title, homeName, awayName, xHome, xAway, xTotal, lines, sinalFn, warning }) {
  const useSinal = sinalFn || sinalPoisson;

  const closestLine = (lines && lines.length > 0 && xTotal != null)
    ? lines.reduce((a, b) => Math.abs(a - xTotal) < Math.abs(b - xTotal) ? a : b)
    : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">{icon}</span>
          <h3 className="font-semibold tracking-tight text-sm sm:text-base truncate">{title}</h3>
        </div>
      </div>

      <div className="divide-y">
        <div className="grid grid-cols-3 text-center text-sm">
          <div className="px-3 py-3 bg-slate-50">
            <p className="text-xs text-muted-foreground mb-0.5 truncate">{homeName}</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{xHome ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-slate-50">
            <p className="text-xs text-muted-foreground mb-0.5 truncate">{awayName}</p>
            <p className="text-lg sm:text-xl font-bold text-slate-900">{xAway ?? "—"}</p>
          </div>
          <div className="px-3 py-3 bg-blue-50">
            <p className="text-xs text-muted-foreground mb-0.5 truncate">Total Esperado</p>
            <p className="text-lg sm:text-xl font-bold text-blue-700">{xTotal}</p>
          </div>
        </div>

        <div className="px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Linhas Over/Under</p>
          <div className="space-y-1.5">
            {lines.map(line => {
              const prob = poissonOver(xTotal, line);
              const sinal = useSinal(prob);
              const isClosest = line === closestLine;
              return (
                <div
                  key={line}
                  className={`flex items-center justify-between py-1.5 px-3 rounded-lg ${
                    isClosest ? "bg-blue-50 border border-blue-200" : "bg-slate-50"
                  } hover:bg-slate-100 transition-colors`}
                >
                  <span className="text-sm font-medium text-slate-700">Over {line}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums">{(prob * 100).toFixed(1)}%</span>
                    <SignalBadge label={sinal.label} color={sinal.color} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {warning && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-100">
          <p className="text-xs text-amber-700">{warning}</p>
        </div>
      )}
    </div>
  );
}