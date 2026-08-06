import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Calendar, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS, COMMERCIAL_LINES } from "@/lib/predictionEngine";

function bestSignalCommercial(market, xTotal, lines, sinalFn = sinalPoisson) {
  if (!lines || !lines.length || xTotal == null) return null;
  const closestLine = lines.reduce((a, b) => Math.abs(a - xTotal) < Math.abs(b - xTotal) ? a : b);
  const prob = poissonOver(xTotal, closestLine);
  const oddMinima = prob > 0 ? Math.max(1.01, Math.round((1 / prob) * 100) / 100) : "—";
  const sinal = sinalFn(prob);
  const strength = Math.abs(prob - 0.5);

  return { market, line: closestLine, prob, oddMinima, sinal, strength };
}

function getMatchSignals(match) {
  const r = match.results;
  if (!r) return [];

  const signals = [];

  // 1X2 Strict Outcome (Vitória Casa, Empate, Vitória Fora)
  if (r.pick_1x2) {
    signals.push({
      market: "Resultado 1X2",
      prob: r.pick_1x2.prob,
      oddMinima: r.pick_1x2.odd_minima,
      sinal: { label: r.pick_1x2.resultado, color: "green" },
      strength: r.pick_1x2.prob - 0.33,
      isResult: true,
    });
  }

  // Corners
  const corners = bestSignalCommercial("Escanteios", r.xc_total, COMMERCIAL_LINES.corners_total);
  if (corners && corners.sinal.label !== "NEUTRO") signals.push(corners);

  // Goals
  const goals = bestSignalCommercial("Gols", r.xg_total, COMMERCIAL_LINES.goals_total, sinalPoissonGols);
  if (goals && goals.sinal.label !== "NEUTRO") signals.push(goals);

  // Shots on Target
  const shots = bestSignalCommercial("Chutes no Gol", r.xs_total, COMMERCIAL_LINES.shots_target_total);
  if (shots && shots.sinal.label !== "NEUTRO") signals.push(shots);

  // Cards
  const cards = bestSignalCommercial("Cartões", r.xcard_total, COMMERCIAL_LINES.cards_total);
  if (cards && cards.sinal.label !== "NEUTRO") signals.push(cards);

  // Saves
  const saves = bestSignalCommercial("Defesas Goleiro", r.xsaves_total, COMMERCIAL_LINES.saves_total);
  if (saves && saves.sinal.label !== "NEUTRO") signals.push(saves);

  // Total Shots
  const totalshots = bestSignalCommercial("Chutes Totais", r.xtotalshots_total, COMMERCIAL_LINES.total_shots_total);
  if (totalshots && totalshots.sinal.label !== "NEUTRO") signals.push(totalshots);

  // BTTS Bivariado
  if (r.p_btts != null) {
    const sBTTS = sinalBTTS(r.p_btts);
    if (sBTTS.label !== "NEUTRO") {
      signals.push({
        market: "Ambas Marcam",
        prob: r.p_btts,
        oddMinima: r.p_btts > 0 ? Math.max(1.01, Math.round((1 / r.p_btts) * 100) / 100) : "—",
        sinal: sBTTS,
        strength: Math.abs(r.p_btts - 0.5),
        isBTTS: true,
      });
    }
  }

  return signals.sort((a, b) => b.strength - a.strength);
}

const colorClasses = {
  green: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40",
  yellow: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
  red: "bg-rose-950/80 text-rose-300 border border-rose-500/40",
  gray: "bg-slate-800 text-slate-300 border border-slate-700",
};

export default function DailyOverview() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.entities.Match.list("-date", 100).then(setMatches).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-4 bg-slate-900/80 rounded-xl border border-slate-800">
        <Skeleton className="h-6 w-48 bg-slate-800" />
        <Skeleton className="h-28 w-full bg-slate-800" />
        <Skeleton className="h-28 w-full bg-slate-800" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800 text-white">
        <p className="text-slate-300 font-bold text-base">Nenhum jogo cadastrado ainda.</p>
        <p className="text-xs text-slate-400 mt-1">Cadastre jogos para visualizar o painel de Apostas do Dia.</p>
      </div>
    );
  }

  // Agrupa por data
  const grouped = matches.reduce((acc, m) => {
    const d = m.date || "Sem data";
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  const dateLabels = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const formatDate = (dateStr) => {
    if (dateStr === "Sem data") return dateStr;
    try {
      const d = new Date(dateStr + "T00:00:00");
      return d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 text-white">
      {dateLabels.map((dateKey) => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-extrabold text-slate-200 uppercase tracking-wide capitalize">
              {formatDate(dateKey)}
            </h3>
            <span className="text-xs text-slate-400 font-semibold">({grouped[dateKey].length} {grouped[dateKey].length === 1 ? "jogo" : "jogos"})</span>
          </div>

          <div className="space-y-3">
            {grouped[dateKey].map((match) => {
              const signals = getMatchSignals(match);
              const topSignal = signals[0];

              return (
                <div
                  key={match.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden hover:border-slate-700 transition-all cursor-pointer shadow-xl group"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  <div className="px-4 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        match.status === "completed" ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
                      }`} />
                      <p className="font-extrabold text-base text-white">
                        {match.home_team} <span className="text-emerald-400 font-bold mx-1 text-sm">vs</span> {match.away_team}
                      </p>
                      {match.real_results && Object.keys(match.real_results).length > 0 && (
                        <p className="text-xs text-emerald-400 font-bold ml-2 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                          ✓ Resultado Registrado
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                  </div>

                  <div className="p-3.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {signals.map((sig, i) => (
                      <div key={i} className="rounded-lg bg-slate-950/60 p-3 text-center border border-slate-800/80">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide truncate">{sig.market}</p>
                        {sig.isResult ? (
                          <>
                            <p className="text-base font-black mt-0.5 text-emerald-400 truncate">{sig.sinal.label}</p>
                            <p className="text-xs font-bold text-white tabular-nums">{(sig.prob * 100).toFixed(1)}% <span className="text-slate-400 text-[10px]">(Odd {sig.oddMinima})</span></p>
                          </>
                        ) : sig.isBTTS ? (
                          <>
                            <p className="text-lg font-black text-white tabular-nums mt-0.5">{(sig.prob * 100).toFixed(1)}%</p>
                            <p className="text-[10px] text-emerald-400 font-bold">Odd Justa: {sig.oddMinima}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-slate-200 mt-0.5">Over {sig.line}</p>
                            <p className="text-lg font-black text-white tabular-nums">{(sig.prob * 100).toFixed(1)}%</p>
                            <p className="text-[10px] text-emerald-400 font-bold">Odd Justa: {sig.oddMinima}</p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {topSignal && (
                    <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Aposta de Maior Valor:
                      </span>
                      <span className="font-extrabold text-emerald-400 tabular-nums">
                        {topSignal.isResult
                          ? `${topSignal.sinal.label} — ${(topSignal.prob * 100).toFixed(1)}% (Odd Justa: ${topSignal.oddMinima})`
                          : topSignal.isBTTS
                          ? `Ambas Marcam (${topSignal.sinal.label}) — ${(topSignal.prob * 100).toFixed(1)}% (Odd Justa: ${topSignal.oddMinima})`
                          : `${topSignal.market} Over ${topSignal.line} — ${(topSignal.prob * 100).toFixed(1)}% (Odd Justa: ${topSignal.oddMinima})`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}