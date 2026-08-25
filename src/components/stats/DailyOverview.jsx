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

  // Goals (Mercado Validade)
  const goals = bestSignalCommercial("Gols", r.xg_total, COMMERCIAL_LINES.goals_total, sinalPoissonGols);
  if (goals && goals.sinal.label !== "NEUTRO") signals.push(goals);

  // Cards (Mercado Validade)
  const cards = bestSignalCommercial("Cartões", r.xcard_total, COMMERCIAL_LINES.cards_total);
  if (cards && cards.sinal.label !== "NEUTRO") signals.push(cards);

  // Saves (Mercado Validade)
  const saves = bestSignalCommercial("Defesas Goleiro", r.xsaves_total, COMMERCIAL_LINES.saves_total);
  if (saves && saves.sinal.label !== "NEUTRO") signals.push(saves);

  // BTTS Bivariado (Mercado Validade)
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

  // Mercados em Estudo (Escanteios, Chutes no Gol, Faltas, Chutes Totais) são EXCLUÍDOS da lista de palpites do dia
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
    base44.entities.Match.list("-date", 500).then(setMatches).finally(() => setLoading(false));
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
            <span className="text-xs font-semibold text-slate-400">({grouped[dateKey].length} jogos)</span>
          </div>

          <div className="space-y-3">
            {grouped[dateKey].map((m) => {
              const signals = getMatchSignals(m);
              const topSignal = signals[0];

              return (
                <div
                  key={m.id}
                  onClick={() => navigate(`/match/${m.id}`)}
                  className="group bg-slate-900/90 hover:bg-slate-850 rounded-xl p-4 border border-slate-800/80 hover:border-slate-700 transition-all cursor-pointer shadow-lg hover:shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="text-center min-w-[70px] shrink-0 border-r border-slate-800 pr-4">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        {m.status === "completed" ? "FINALIZADO" : "EM BREVE"}
                      </span>
                      <span className="text-xs font-extrabold text-slate-300 font-mono mt-0.5 block">
                        {m.date ? m.date.split("-").slice(1).join("/") : "—"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 font-black text-sm text-white">
                        <span>{m.home_team}</span>
                        <span className="text-xs text-slate-500 font-normal">vs</span>
                        <span>{m.away_team}</span>
                      </div>

                      {topSignal ? (
                        <div className="flex items-center gap-2 mt-1 text-xs">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="text-slate-300 font-semibold truncate">
                            Destaque: <strong className="text-white">{topSignal.market}</strong> —{" "}
                            {topSignal.isResult
                              ? topSignal.sinal.label
                              : topSignal.isBTTS
                              ? `${topSignal.market}: ${topSignal.prob >= 0.5 ? "SIM" : "NÃO"}`
                              : `Over ${topSignal.line}`}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">Clique para ver análise completa</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                    {topSignal && (
                      <div className="flex items-center gap-2">
                        <div className="text-right tabular-nums">
                          <span className="text-xs font-black text-emerald-400 block">
                            {(topSignal.prob * 100).toFixed(1)}%
                          </span>
                          <span className="text-[11px] text-slate-400 font-semibold">
                            Odd: <strong className="text-white">{topSignal.oddMinima}</strong>
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${colorClasses[topSignal.sinal.color] || colorClasses.green}`}>
                          {topSignal.sinal.label}
                        </span>
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all ml-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}