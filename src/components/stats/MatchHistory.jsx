import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronRight, CheckCircle, Clock, CheckCircle2, XCircle } from "lucide-react";
import { avaliarPalpiteExplicit } from "@/lib/predictionEngine";

export default function MatchHistory({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Match.list("-created_date", 50).then(setMatches).finally(() => setLoading(false));
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
        const eval1x2 = match.results?.pick_1x2
          ? avaliarPalpiteExplicit("1x2", match.results.pick_1x2, rr)
          : { status: "PENDENTE" };

        return (
          <button
            key={match.id}
            onClick={() => onSelectMatch(match)}
            className="w-full flex items-center justify-between px-5 py-4 rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md hover:bg-slate-800/80 transition-all text-left group shadow-lg"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-1.5 flex-shrink-0">
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
              <div className="min-w-0">
                <div className="flex items-center gap-2">
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
                </div>
                <p className="text-xs font-semibold text-slate-400 mt-0.5">{match.date || "Sem data informada"}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs font-bold tabular-nums">
                <span className="bg-slate-950/80 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  ⚽ {match.results?.xg_total ?? "—"}
                </span>
                <span className="bg-slate-950/80 text-blue-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  🔲 {match.results?.xc_total ?? "—"}
                </span>
                <span className="bg-slate-950/80 text-amber-400 px-2.5 py-1 rounded-lg border border-slate-800 shadow-inner">
                  🟨 {match.results?.xcard_total ?? "—"}
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