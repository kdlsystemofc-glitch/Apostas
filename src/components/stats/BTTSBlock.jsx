import React from "react";
import { sinalBTTS, avaliarPalpiteExplicit } from "@/lib/predictionEngine";
import { CheckCircle2, XCircle } from "lucide-react";
import SignalBadge from "./SignalBadge";

export default function BTTSBlock({ homeName, awayName, pBtts, details, realValue }) {
  const sinal = sinalBTTS(pBtts);
  const isOver = pBtts >= 0.50;
  const palpiteObj = { palpite: isOver ? "Ambas Marcam: SIM" : "Ambas Marcam: NÃO" };

  const evalResult = avaliarPalpiteExplicit("btts", palpiteObj, realValue);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-xl text-white">
      <div className="px-5 py-3 bg-slate-950 text-white flex items-center justify-between gap-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔁</span>
          <h3 className="font-semibold tracking-tight text-base text-slate-100">Ambas Marcam (BTTS)</h3>
        </div>
        {evalResult.status !== "PENDENTE" && (
          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-md ${
            evalResult.isGreen
              ? "bg-emerald-600 text-white border border-emerald-400"
              : "bg-rose-600 text-white border border-rose-400"
          }`}>
            {evalResult.isGreen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {evalResult.isGreen ? "GREEN (ACERTOU)" : "RED (ERROU)"}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Palpite Assumido pelo Sistema */}
        <div className={`p-4 rounded-xl border-2 text-center transition-all ${
          evalResult.status === "PENDENTE"
            ? "border-emerald-500/40 bg-slate-900/40"
            : evalResult.isGreen
            ? "border-emerald-500 bg-emerald-950/30"
            : "border-rose-500 bg-rose-950/30"
        }`}>
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block mb-1">
            🔥 Palpite Assumido pelo Sistema
          </span>
          <p className="text-xl font-extrabold text-white">
            {palpiteObj.palpite}
          </p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className={`text-2xl font-black tabular-nums ${isOver ? "text-emerald-400" : "text-purple-400"}`}>
              {isOver ? (pBtts * 100).toFixed(1) : ((1 - pBtts) * 100).toFixed(1)}%
            </span>
            <SignalBadge label={sinal.label} color={sinal.color} size="lg" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-950/60 p-3 text-center border border-slate-800">
            <p className="text-xs text-slate-400 font-semibold">xGols {homeName}</p>
            <p className="text-lg font-bold text-white tabular-nums">{details.xg_casa?.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">P(Marca)</p>
            <p className={`text-sm font-extrabold tabular-nums ${details.p_casa_marca >= 0.50 ? "text-emerald-400" : "text-purple-400"}`}>
              {(details.p_casa_marca * 100).toFixed(1)}%
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-3 text-center border border-slate-800">
            <p className="text-xs text-slate-400 font-semibold">xGols {awayName}</p>
            <p className="text-lg font-bold text-white tabular-nums">{details.xg_fora?.toFixed(2)}</p>
            <p className="text-xs text-slate-400 mt-1 font-semibold">P(Marca)</p>
            <p className={`text-sm font-extrabold tabular-nums ${details.p_fora_marca >= 0.50 ? "text-emerald-400" : "text-purple-400"}`}>
              {(details.p_fora_marca * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}