import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Calendar } from "lucide-react";
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

  // BTTS
  const bttsSinal = sinalBTTS(r.p_btts);
  const bttsOddMin = r.p_btts > 0 ? Math.max(1.01, Math.round((1 / r.p_btts) * 100) / 100) : "—";
  signals.push({
    market: "Ambas Marcam",
    prob: r.p_btts,
    oddMinima: bttsOddMin,
    sinal: bttsSinal,
    strength: Math.abs(r.p_btts - 0.5),
    isBTTS: true,
  });

  return signals.sort((a, b) => b.strength - a.strength);
}

const colorClasses = {
  green: "bg-emerald-500 text-white",
  yellow: "bg-amber-400 text-amber-950",
  red: "bg-red-500 text-white",
  gray: "bg-slate-300 text-slate-700",
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
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Nenhuma análise realizada ainda.</p>
        <p className="text-sm text-muted-foreground mt-1">Crie sua primeira análise na aba "Nova Análise".</p>
      </div>
    );
  }

  const grouped = {};
  matches.forEach((m) => {
    const dateKey = m.date || "Sem data";
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(m);
  });

  const dateLabels = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

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
    <div className="space-y-6">
      {dateLabels.map((dateKey) => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide capitalize">
              {formatDate(dateKey)}
            </h3>
            <span className="text-xs text-muted-foreground">({grouped[dateKey].length} {grouped[dateKey].length === 1 ? "jogo" : "jogos"})</span>
          </div>

          <div className="space-y-3">
            {grouped[dateKey].map((match) => {
              const signals = getMatchSignals(match);
              const topSignal = signals[0];

              return (
                <div
                  key={match.id}
                  className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/match/${match.id}`)}
                >
                  <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        match.status === "completed" ? "bg-emerald-500" : "bg-amber-400"
                      }`} />
                      <p className="font-semibold text-sm">
                        {match.home_team} <span className="text-muted-foreground font-normal mx-0.5">vs</span> {match.away_team}
                      </p>
                      {match.real_results && Object.keys(match.real_results).length > 0 && (
                        <p className="text-xs text-emerald-600 font-medium ml-2">✓ Resultado registrado</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {signals.map((sig, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-3 text-center border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide truncate">{sig.market}</p>
                        {sig.isResult ? (
                          <>
                            <p className="text-base font-extrabold mt-0.5 text-emerald-700">{sig.sinal.label}</p>
                            <p className="text-xs font-semibold">{(sig.prob * 100).toFixed(0)}% <span className="text-muted-foreground text-[10px]">(Odd {sig.oddMinima})</span></p>
                          </>
                        ) : sig.isBTTS ? (
                          <>
                            <p className="text-lg font-bold mt-0.5">{(sig.prob * 100).toFixed(0)}%</p>
                            <p className="text-[10px] text-emerald-600 font-bold">Odd Min: {sig.oddMinima}</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] font-bold text-slate-800 mt-0.5">Over {sig.line}</p>
                            <p className="text-lg font-bold">{(sig.prob * 100).toFixed(0)}%</p>
                            <p className="text-[10px] text-emerald-600 font-bold">Odd Min: {sig.oddMinima}</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {topSignal && (
                    <div className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
                      <span className="text-slate-300">🔥 Aposta de Maior Valor:</span>
                      <span className="font-semibold text-emerald-400">
                        {topSignal.isResult
                          ? `${topSignal.sinal.label} — ${(topSignal.prob * 100).toFixed(0)}% (Odd Min: ${topSignal.oddMinima})`
                          : topSignal.isBTTS
                          ? `Ambas Marcam (${topSignal.sinal.label}) — ${(topSignal.prob * 100).toFixed(0)}% (Odd Min: ${topSignal.oddMinima})`
                          : `${topSignal.market} Over ${topSignal.line} — ${(topSignal.prob * 100).toFixed(0)}% (Odd Min: ${topSignal.oddMinima})`}
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