import React, { useState } from "react";
import { calcularQuarterKelly, avaliarPalpiteExplicit } from "@/lib/predictionEngine";
import { useBankrollStore } from "@/store/useBankrollStore";
import { Trophy, TrendingUp, DollarSign, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";

export default function MatchResultBlock({ match }) {
  const [bookieOdd, setBookieOdd] = useState("");
  const { calculateStakeAmount } = useBankrollStore();

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

  // Avaliação de Resultado Real GREEN / RED
  const realRes = match.real_results || {
    real_goals_home: match.real_goals_home,
    real_goals_away: match.real_goals_away,
  };
  const evalResult = avaliarPalpiteExplicit("1x2", pick, realRes);

  // Gestão de Risco e Stake via Quarter-Kelly
  const kelly = calcularQuarterKelly(pick.prob, bookieOdd);
  const oddNum = parseFloat(bookieOdd);
  const hasBookieOdd = !isNaN(oddNum) && oddNum > 1.0;
  const stakeReais = hasBookieOdd && kelly.isEVPlus ? calculateStakeAmount(kelly.stakePct) : 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-xl">
      {/* Header do Card */}
      <div className="px-5 py-3.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
        <h3 className="font-semibold flex items-center gap-2 text-base text-slate-100">
          <Trophy className="w-4 h-4 text-emerald-400" /> Resultado Esperado (1X2)
        </h3>
        <div className="flex items-center gap-2">
          {evalResult.status !== "PENDENTE" && (
            <span className={`text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-md ${
              evalResult.isGreen
                ? "bg-emerald-600 text-white border border-emerald-400"
                : "bg-rose-600 text-white border border-rose-400"
            }`}>
              {evalResult.isGreen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {evalResult.isGreen ? "GREEN (ACERTOU)" : "RED (ERROU)"}
            </span>
          )}
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
            Modelo Dixon-Coles V2.1
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* HERO DECISION CARD (Teste do Olhar de 1 Segundo) */}
        <div className={`rounded-xl border-2 p-4 relative overflow-hidden transition-all ${
          evalResult.status === "PENDENTE"
            ? "border-emerald-500/40 bg-emerald-950/20"
            : evalResult.isGreen
            ? "border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/10"
            : "border-rose-500 bg-rose-950/30 shadow-lg shadow-rose-500/10"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              🔥 Palpite Assumido pelo Sistema (1-Second Decision)
            </span>
            <span className="text-xs font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded shadow-sm">
              {(pick.prob * 100).toFixed(1)}% Confiança
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
            <div className="flex items-center gap-3">
              <p className="text-2xl font-black text-white tracking-tight">
                {pickTitle}
              </p>
              {evalResult.status !== "PENDENTE" && (
                <span className={`text-xs font-black px-2.5 py-1 rounded border uppercase ${
                  evalResult.isGreen ? "bg-emerald-950 text-emerald-300 border-emerald-500" : "bg-rose-950 text-rose-300 border-rose-500"
                }`}>
                  {evalResult.isGreen ? "✓ Resultado Correto" : "✗ Resultado Incorreto"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold text-slate-200 bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-700 shadow-sm tabular-nums">
                Odd Justa: <span className="text-emerald-400 font-extrabold">{pick.odd_minima}</span>
              </div>
              {hasBookieOdd && (
                <div className={`text-xs font-extrabold px-3 py-1.5 rounded-lg border tabular-nums ${
                  kelly.isEVPlus
                    ? "bg-emerald-600 text-white border-emerald-500 shadow-sm"
                    : "bg-rose-950/80 text-rose-300 border-rose-800"
                }`}>
                  {kelly.isEVPlus ? `🔥 EV+ +${kelly.evPct.toFixed(1)}%` : `EV ${kelly.evPct.toFixed(1)}%`}
                </div>
              )}
            </div>
          </div>

          {/* Calculador de Odd da Casa & Stake em Reais */}
          <div className="mt-3.5 pt-3 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-300 font-semibold whitespace-nowrap">Odd da Casa (Bet365 / Pinnacle):</span>
              <input
                type="number"
                step="0.01"
                min="1.01"
                placeholder="Ex: 2.10"
                value={bookieOdd}
                onChange={(e) => setBookieOdd(e.target.value)}
                className="w-24 px-2 py-1 rounded border border-slate-700 bg-slate-950 text-white font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            {hasBookieOdd && (
              <div>
                {kelly.isEVPlus ? (
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300 bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-sm">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Stake Sugerida: <strong>{kelly.stakePct}%</strong> ({`R$ ${stakeReais.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`})</span>
                  </div>
                ) : (
                  <span className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> Sem valor esperado frente à Odd digitada
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Barra Visual de Probabilidades (1X2) */}
        <div className="space-y-2">
          <div className="flex rounded-full overflow-hidden h-9 text-xs font-bold shadow-inner border border-slate-800">
            <div className="bg-emerald-600 text-white flex items-center justify-center transition-all tabular-nums"
                 style={{ width: barWidth(r.p_casa_vence) }}>
              {(r.p_casa_vence * 100).toFixed(1)}%
            </div>
            <div className="bg-amber-600 text-white flex items-center justify-center transition-all tabular-nums"
                 style={{ width: barWidth(r.p_empate) }}>
              {(r.p_empate * 100).toFixed(1)}%
            </div>
            <div className="bg-rose-600 text-white flex items-center justify-center transition-all tabular-nums"
                 style={{ width: barWidth(r.p_fora_vence) }}>
              {(r.p_fora_vence * 100).toFixed(1)}%
            </div>
          </div>
          <div className="flex justify-between text-xs font-bold px-1">
            <span className="text-emerald-400">Mandante: {home}</span>
            <span className="text-amber-400">Empate</span>
            <span className="text-rose-400">Visitante: {away}</span>
          </div>
        </div>

        {/* Handicaps e Placares Prováveis */}
        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          {/* Handicaps Derivados */}
          {r.handicaps && (
            <div className="rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" /> Handicaps Asiáticos Derivados
              </p>
              <div className="space-y-2 text-xs font-semibold text-slate-300 tabular-nums">
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span>DNB (AH 0.0) {home}:</span>
                  <strong className="text-emerald-400">
                    {(r.handicaps.dnb_home * 100).toFixed(1)}% (Odd {(1 / r.handicaps.dnb_home).toFixed(2)})
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1">
                  <span>DNB (AH 0.0) {away}:</span>
                  <strong className="text-emerald-400">
                    {(r.handicaps.dnb_away * 100).toFixed(1)}% (Odd {(1 / r.handicaps.dnb_away).toFixed(2)})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>AH -1.5 {home}:</span>
                  <strong className="text-white">
                    {(r.handicaps.ah_minus_15_home * 100).toFixed(1)}%
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Placares Mais Prováveis */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Top 5 Placares Mais Prováveis
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {r.placares_top5?.map((p, i) => (
                <div key={i} className="rounded-lg bg-slate-950/80 p-2 text-center border border-slate-800">
                  <p className="text-sm font-extrabold text-white">{p.placar}</p>
                  <p className="text-[11px] text-slate-400 font-bold tabular-nums">{(p.prob * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
