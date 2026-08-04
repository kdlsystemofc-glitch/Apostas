import React from "react";
import MarketBlock from "./MarketBlock";
import BTTSBlock from "./BTTSBlock";
import { sinalPoissonGols, COMMERCIAL_LINES } from "@/lib/predictionEngine";

export default function MatchResults({ match }) {
  const r = match.results;
  const home = match.home_team;
  const away = match.away_team;

  return (
    <div className="space-y-5">
      <div className="text-center pb-2">
        <h2 className="text-2xl font-bold tracking-tight">{home} <span className="text-muted-foreground font-normal">vs</span> {away}</h2>
        {match.date && <p className="text-sm text-muted-foreground mt-0.5">{match.date}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MarketBlock
          icon="🔲"
          title="Escanteios Total"
          homeName={home}
          awayName={away}
          xHome={r.xc_casa}
          xAway={r.xc_fora}
          xTotal={r.xc_total}
          lines={COMMERCIAL_LINES.corners_total}
        />
        <MarketBlock
          icon="⚽"
          title="Gols Total"
          homeName={home}
          awayName={away}
          xHome={r.xg_casa}
          xAway={r.xg_fora}
          xTotal={r.xg_total}
          lines={COMMERCIAL_LINES.goals_total}
          sinalFn={sinalPoissonGols}
        />
        <MarketBlock
          icon="🎯"
          title="Chutes no Gol Total"
          homeName={home}
          awayName={away}
          xHome={r.xs_casa}
          xAway={r.xs_fora}
          xTotal={r.xs_total}
          lines={COMMERCIAL_LINES.shots_target_total}
        />
        <MarketBlock
          icon="🟨"
          title="Cartões Total"
          homeName={home}
          awayName={away}
          xHome={r.xcard_casa}
          xAway={r.xcard_fora}
          xTotal={r.xcard_total}
          lines={COMMERCIAL_LINES.cards_total}
        />
        <MarketBlock
          icon="💥"
          title="Chutes Totais"
          homeName={home}
          awayName={away}
          xHome={r.xtotalshots_casa}
          xAway={r.xtotalshots_fora}
          xTotal={r.xtotalshots_total}
          lines={COMMERCIAL_LINES.total_shots_total}
        />
        <MarketBlock
          icon="🤜"
          title="Faltas Total"
          homeName={home}
          awayName={away}
          xHome={r.xfouls_casa}
          xAway={r.xfouls_fora}
          xTotal={r.xfouls_total}
          lines={COMMERCIAL_LINES.fouls_total}
          warning="⚠ Mercado com alta variância — sinais removidos das recomendações automáticas"
        />
        <MarketBlock
          icon="🧤"
          title="Defesas do Goleiro Total"
          homeName={home}
          awayName={away}
          xHome={r.xsaves_casa}
          xAway={r.xsaves_fora}
          xTotal={r.xsaves_total}
          lines={COMMERCIAL_LINES.saves_total}
        />
        <MarketBlock
          icon="🔲"
          title={`Escanteios ${home}`}
          homeName={home}
          awayName={away}
          xHome={r.xc_casa}
          xAway={null}
          xTotal={r.xc_casa}
          lines={COMMERCIAL_LINES.corners_team}
        />
        <MarketBlock
          icon="🔲"
          title={`Escanteios ${away}`}
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={r.xc_fora}
          xTotal={r.xc_fora}
          lines={COMMERCIAL_LINES.corners_team}
        />
        <MarketBlock
          icon="⚽"
          title={`Gols ${home}`}
          homeName={home}
          awayName={away}
          xHome={r.xg_casa}
          xAway={null}
          xTotal={r.xg_casa}
          lines={COMMERCIAL_LINES.goals_team}
          sinalFn={sinalPoissonGols}
        />
        <MarketBlock
          icon="⚽"
          title={`Gols ${away}`}
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={r.xg_fora}
          xTotal={r.xg_fora}
          lines={COMMERCIAL_LINES.goals_team}
          sinalFn={sinalPoissonGols}
        />
      </div>

      <BTTSBlock
        homeName={home}
        awayName={away}
        pBtts={r.p_btts}
        details={r.db}
      />
    </div>
  );
}