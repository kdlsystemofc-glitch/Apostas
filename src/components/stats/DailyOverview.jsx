import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronRight, Calendar } from "lucide-react";
import { poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS } from "@/lib/predictionEngine";

function linhasDinamicas(x, nLados = 3) {
  // Linhas de aposta REAIS: sempre X.5, espaçamento de 1 em 1.
  // Casas de aposta só usam Over 0.5, 1.5, 2.5, 3.5, 4.5, ...
  // Nunca Over 3.0, Over 10.0, Over 28.0 — esses não existem.
  if (!x || x <= 0) return [];
  // Centro = X.5 mais próximo do xValor
  const centro = Math.floor(x) + 0.5;
  const linhas = [];
  for (let i = -nLados; i <= nLados; i++) {
    const l = centro + i;
    if (l >= 0.5) linhas.push(l);
  }
  return linhas;
}

// Returns the strongest signal (highest prob away from 50%) for a given market
function bestSignal(market, xTotal, sinalFn = sinalPoisson) {
  const lines = linhasDinamicas(xTotal);
  if (!lines.length) return null;
  let bestOver = null;
  let bestUnder = null;
  for (const line of lines) {
    const prob = poissonOver(xTotal, line);
    const sinal = sinalFn(prob);
    const strength = Math.abs(prob - 0.5);
    if (prob >= 0.5) {
      if (!bestOver || strength > bestOver.strength)
        bestOver = { market, line, prob, sinal, strength };
    } else {
      if (!bestUnder || strength > bestUnder.strength)
        bestUnder = { market, line, prob, sinal, strength };
    }
  }
  if (bestOver && bestOver.sinal.label !== "NEUTRO") return bestOver;
  if (bestUnder && bestUnder.sinal.label !== "NEUTRO") return bestUnder;
  if (bestOver && bestUnder)
    return bestOver.strength >= bestUnder.strength ? bestOver : bestUnder;
  return bestOver || bestUnder;
}

function getMatchSignals(match) {
  const r = match.results;
  if (!r) return [];

  const signals = [];

  // Corners
  const corners = bestSignal("Escanteios", r.xc_total);
  if (corners && corners.sinal.label !== "NEUTRO") signals.push(corners);

  // Goals
  const goals = bestSignal("Gols", r.xg_total, sinalPoissonGols);
  if (goals && goals.sinal.label !== "NEUTRO") signals.push(goals);

  // Shots on Target
  const shots = bestSignal("Chutes no Gol", r.xs_total);
  if (shots && shots.sinal.label !== "NEUTRO") signals.push(shots);

  // Cards
  const cards = bestSignal("Cartões", r.xcard_total);
  if (cards && cards.sinal.label !== "NEUTRO") signals.push(cards);

  // BTTS
  const bttsSinal = sinalBTTS(r.p_btts);
  signals.push({
    market: "Ambas Marcam",
    prob: r.p_btts,
    sinal: bttsSinal,
    strength: Math.abs(r.p_btts - 0.5),
    isBTTS: true,
  });

  // Sort by strength descending
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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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

  // Group by date
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
                  {/* Header */}
                  <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">
                        {match.home_team} <span className="text-muted-foreground font-normal mx-0.5">vs</span> {match.away_team}
                      </p>
                      {match.real_results && Object.keys(match.real_results).length > 0 && (
                        <p className="text-xs text-emerald-600 font-medium mt-0.5">✓ Resultado registrado</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>

                  {/* Signals */}
                  <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {signals.map((sig, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 p-2.5 text-center">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">{sig.market}</p>
                        {sig.isBTTS ? (
                          <>
                            <p className="text-base font-bold mt-0.5">{(sig.prob * 100).toFixed(0)}%</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Over {sig.line}</p>
                            <p className="text-base font-bold">{(sig.prob * 100).toFixed(0)}%</p>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorClasses[sig.sinal.color]}`}>
                              {sig.sinal.label}
                            </span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Top pick highlight */}
                  {topSignal && (
                    <div className="px-4 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
                      <span className="text-slate-300">🔥 Melhor aposta:</span>
                      <span className="font-semibold">
                        {topSignal.isBTTS
                          ? `Ambas Marcam — ${(topSignal.prob * 100).toFixed(0)}%`
                          : `${topSignal.market} Over ${topSignal.line} — ${(topSignal.prob * 100).toFixed(0)}%`}
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