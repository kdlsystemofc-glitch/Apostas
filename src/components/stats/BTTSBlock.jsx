import React from "react";
import { sinalBTTS } from "@/lib/predictionEngine";
import SignalBadge from "./SignalBadge";

export default function BTTSBlock({ homeName, awayName, pBtts, details }) {
  const sinal = sinalBTTS(pBtts);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 text-white flex items-center gap-2">
        <span className="text-lg">🔁</span>
        <h3 className="font-semibold tracking-tight">Ambas Marcam (BTTS)</h3>
      </div>

      <div className="p-5 space-y-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-slate-900">{(pBtts * 100).toFixed(1)}%</p>
          <div className="mt-2">
            <SignalBadge label={sinal.label} color={sinal.color} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">xGols {homeName}</p>
            <p className="text-lg font-bold">{details.xg_casa?.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">P(Marca)</p>
            <p className="text-sm font-semibold">{(details.p_casa_marca * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">xGols {awayName}</p>
            <p className="text-lg font-bold">{details.xg_fora?.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-1">P(Marca)</p>
            <p className="text-sm font-semibold">{(details.p_fora_marca * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}