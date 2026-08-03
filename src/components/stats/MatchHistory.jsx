import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ChevronRight, CheckCircle, Clock } from "lucide-react";

export default function MatchHistory({ onSelectMatch }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Match.list("-created_date", 50).then(setMatches).finally(() => setLoading(false));
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

  return (
    <div className="space-y-2">
      {matches.map((match) => (
        <button
          key={match.id}
          onClick={() => onSelectMatch(match)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-xl border bg-card hover:bg-slate-50 transition-colors text-left group"
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {match.status === "completed" ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : (
                <Clock className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div>
              <p className="font-semibold text-sm">
                {match.home_team} <span className="text-muted-foreground font-normal">vs</span> {match.away_team}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{match.date || "Sem data"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground">
              <span>⚽ {match.results?.xg_total}</span>
              <span>🔲 {match.results?.xc_total}</span>
              <span>🟨 {match.results?.xcard_total}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </button>
      ))}
    </div>
  );
}