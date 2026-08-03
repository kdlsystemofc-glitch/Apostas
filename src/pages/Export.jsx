import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExportTable from "@/components/stats/ExportTable";

function buildRow(m) {
  const r = m.results || {};
  const rr = m.real_results || {};
  const num = (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : null);

  return {
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    date: m.date,

    xc_casa: r.xc_casa,
    xc_fora: r.xc_fora,
    xc_total: r.xc_total,
    xg_casa: r.xg_casa,
    xg_fora: r.xg_fora,
    xg_total: r.xg_total,
    xs_casa: r.xs_casa,
    xs_fora: r.xs_fora,
    xs_total: r.xs_total,
    xcard_casa: r.xcard_casa,
    xcard_fora: r.xcard_fora,
    xcard_total: r.xcard_total,
    p_btts: r.p_btts,

    xfouls_casa: r.xfouls_casa,
    xfouls_fora: r.xfouls_fora,
    xfouls_total: r.xfouls_total,

    xsaves_casa: r.xsaves_casa,
    xsaves_fora: r.xsaves_fora,
    xsaves_total: r.xsaves_total,

    xtotalshots_casa: r.xtotalshots_casa,
    xtotalshots_fora: r.xtotalshots_fora,
    xtotalshots_total: r.xtotalshots_total,

    real_corners_home: num(rr.corners_home),
    real_corners_away: num(rr.corners_away),
    real_corners_total: num(rr.corners_home) !== null && num(rr.corners_away) !== null
      ? (num(rr.corners_home) || 0) + (num(rr.corners_away) || 0)
      : null,
    real_goals_home: num(rr.goals_home),
    real_goals_away: num(rr.goals_away),
    real_goals_total: num(rr.goals_home) !== null && num(rr.goals_away) !== null
      ? (num(rr.goals_home) || 0) + (num(rr.goals_away) || 0)
      : null,
    real_shots_home: num(rr.shots_home),
    real_shots_away: num(rr.shots_away),
    real_shots_total: num(rr.shots_home) !== null && num(rr.shots_away) !== null
      ? (num(rr.shots_home) || 0) + (num(rr.shots_away) || 0)
      : null,
    real_cards_home: num(rr.cards_home),
    real_cards_away: num(rr.cards_away),
    real_cards_total: num(rr.cards_home) !== null && num(rr.cards_away) !== null
      ? (num(rr.cards_home) || 0) + (num(rr.cards_away) || 0)
      : null,

    real_fouls_home: num(rr.fouls_home),
    real_fouls_away: num(rr.fouls_away),
    real_fouls_total: num(rr.fouls_home) !== null && num(rr.fouls_away) !== null
      ? (num(rr.fouls_home) || 0) + (num(rr.fouls_away) || 0)
      : null,

    real_saves_home: num(rr.saves_home),
    real_saves_away: num(rr.saves_away),
    real_saves_total: num(rr.saves_home) !== null && num(rr.saves_away) !== null
      ? (num(rr.saves_home) || 0) + (num(rr.saves_away) || 0)
      : null,

    real_totalshots_home: num(rr.totalshots_home),
    real_totalshots_away: num(rr.totalshots_away),
    real_totalshots_total: num(rr.totalshots_home) !== null && num(rr.totalshots_away) !== null
      ? (num(rr.totalshots_home) || 0) + (num(rr.totalshots_away) || 0)
      : null,

    real_btts: num(rr.btts),
  };
}

export default function Export() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Match.list("-date", 200).then((all) => {
      const filtered = all.filter((m) => m.status === "completed" && m.real_results && m.results);
      setMatches(filtered.map(buildRow));
    }).finally(() => setLoading(false));
  }, []);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(matches, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sports-predictor-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Exportação de Dados</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {matches.length} jogo{matches.length !== 1 ? "s" : ""} com resultado registrado
            </p>
          </div>
          <Button onClick={handleExport} disabled={matches.length === 0} className="gap-1.5">
            <Download className="w-4 h-4" /> Exportar JSON
          </Button>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-20 rounded-xl border bg-card">
            <p className="text-muted-foreground">Nenhum jogo com resultado registrado ainda.</p>
          </div>
        ) : (
          <ExportTable data={matches} />
        )}
      </main>
    </div>
  );
}