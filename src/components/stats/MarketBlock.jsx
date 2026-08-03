import React from "react";
import { poissonOver, sinalPoisson } from "@/lib/predictionEngine";
import SignalBadge from "./SignalBadge";

export default function MarketBlock({ icon, title, homeName, awayName, xHome, xAway, xTotal, lines }) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold tracking-tight">{title}</h3>
      </div>

      <div className="divide-y">
        <div className="grid grid-cols-3 text-center text-sm">
          <div className="px-4 py-3 bg-slate-50">
            <p className="text-xs text-muted-foreground mb-0.5">{homeName}</p>
            <p className="text-xl font-bold text-slate-900">{xHome ?? "—"}</p>
          </div>
          <div className="px-4 py-3 bg-slate-50">
            <p className="text-xs text-muted-foreground mb-0.5">{awayName}</p>
            <p className="text-xl font-bold text-slate-900">{xAway ?? "—"}</p>
          </div>
          <div className="px-4 py-3 bg-blue-50">
            <p className="text-xs text-muted-foreground mb-0.5">Total Esperado</p>
            <p className="text-xl font-bold text-blue-700">{xTotal}</p>
          </div>
        </div>

        <div className="px-4 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Linhas Over/Under</p>
          <div className="space-y-1.5">
            {lines.map(line => {
              const prob = poissonOver(xTotal, line);
              const sinal = sinalPoisson(prob);
              return (
                <div key={line} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
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
    </div>
  );
}