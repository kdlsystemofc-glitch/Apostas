import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronRight, Clock, CheckCircle2, XCircle, Trophy } from "lucide-react";
import { avaliarPalpiteExplicit } from "@/lib/predictionEngine";

export default function MatchHistory({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Match.list("-created_date", 500).then(setMatches).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800">
        <p className="text-slate-300 font-bold text-base">Nenhuma análise realizada ainda.</p>
        <p className="text-xs text-slate-400 mt-1">Crie sua primeira análise na aba "Nova Análise".</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const rr = match.real_results || {
          goals_home: match.real_goals_home,
          goals_away: match.real_goals_away,
        };

        const pick1x2 = match.results?.pick_1x2;
        const eval1x2 = pick1x2
          ? avaliarPalpiteExplicit("1x2", pick1x2, rr)
          : { status: "PENDENTE" };

        const realHome = rr?.goals_home ?? rr?.real_goals_home;
        const realAway = rr?.goals_away ?? rr?.real_goals_away;
        const hasRealScore = realHome !== undefined && realHome !== null && realAway !== undefined && realAway !== null;

        return (
          <button
            key={match.id}
            onClick={() => onSelectMatch(match)}
            className="w-full flex flex-col md:flex-row md:items-center justify-between px-5 py-4 rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md hover:bg-slate-850 hover:border-slate-700 transition-all text-left group shadow-lg gap-3"
          >
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                {match.status === "completed" || eval1x2.status !== "PENDENTE" ? (
                  eval1x2.isGreen ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )
                ) : (
                  <Clock className="w-5 h-5 text-amber-400" />
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-base text-white truncate">
                    {match.home_team} <span className="text-emerald-400 font-bold px-1 text-sm">vs</span> {match.away_team}
                  </p>

                  {eval1x2.status !== "PENDENTE" && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      eval1x2.isGreen ? "bg-emerald-950 text-emerald-300 border-emerald-500" : "bg-rose-950 text-rose-300 border-rose-500"
                    }`}>
                      {eval1x2.isGreen ? "🟢 GREEN" : "🔴 RED"}
                    </span>
                  )}

                  {hasRealScore && (
                    <span className="text-xs font-mono font-extrabold text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      Placar: {realHome} × {realAway}
                    </span>
                  )}
                </div>

                {/* Destaque Externo do Palpite 1X2 no Card */}
                {pick1x2 && (
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800/80 w-fit flex-wrap">
                    <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-slate-400">Palpite Resultado (1X2):</span>
                    <span className="text-emerald-400 font-extrabold">
                      {pick1x2.resultado || pick1x2.palpite}
                    </span>
                    {pick1x2.prob != null && (
                      <span className="text-slate-400 text-[11px] font-mono font-normal">
                        ({(pick1x2.prob * 100).toFixed(1)}% | Odd {pick1x2.odd_minima || pick1x2.odd_justa || "—"})
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs font-semibold text-slate-400">{match.date || "Sem data informada"}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0 justify-between md:justify-end border-t md:border-t-0 border-slate-800/60 pt-2.5 md:pt-0">
              <div className="flex items-center gap-2 text-xs font-bold tabular-nums">
                <span className="bg-slate-950/80 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  ⚽ Gols: {match.results?.xg_total ?? "—"}
                </span>
                <span className="bg-slate-950/80 text-blue-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  🔲 Cantos: {match.results?.xc_total ?? "—"}
                </span>
                <span className="bg-slate-950/80 text-amber-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  🟨 Cards: {match.results?.xcard_total ?? "—"}
                </span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        );
      })}
    </div>
  );
}