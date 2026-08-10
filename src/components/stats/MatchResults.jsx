import React from "react";
import MarketBlock from "./MarketBlock";
import BTTSBlock from "./BTTSBlock";
import { sinalPoissonGols, COMMERCIAL_LINES } from "@/lib/predictionEngine";

export default function MatchResults({ match }) {
  const r = match.results;
  const home = match.home_team;
  const away = match.away_team;
  const rr = match.real_results || {
    real_corners_home: match.real_corners_home,
    real_corners_away: match.real_corners_away,
    real_corners_total: match.real_corners_total,
    real_goals_home: match.real_goals_home,
    real_goals_away: match.real_goals_away,
    real_goals_total: match.real_goals_total,
    real_shots_home: match.real_shots_home,
    real_shots_away: match.real_shots_away,
    real_shots_total: match.real_shots_total,
    real_cards_home: match.real_cards_home,
    real_cards_away: match.real_cards_away,
    real_cards_total: match.real_cards_total,
    real_fouls_home: match.real_fouls_home,
    real_fouls_away: match.real_fouls_away,
    real_fouls_total: match.real_fouls_total,
    real_saves_home: match.real_saves_home,
    real_saves_away: match.real_saves_away,
    real_saves_total: match.real_saves_total,
    real_totalshots_home: match.real_totalshots_home,
    real_totalshots_away: match.real_totalshots_away,
    real_totalshots_total: match.real_totalshots_total,
    real_btts: match.real_btts,
  };

  return (
    <div className="space-y-5">
      <div className="text-center pb-2">
        <h2 className="text-2xl font-black text-white tracking-tight">{home} <span className="text-emerald-400 font-bold mx-1 text-lg">vs</span> {away}</h2>
        {match.date && <p className="text-xs text-slate-400 font-semibold mt-0.5">{match.date}</p>}
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
          realValue={rr?.corners_total ?? rr?.real_corners_total}
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
          realValue={rr?.goals_total ?? rr?.real_goals_total}
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
          realValue={rr?.shots_total ?? rr?.real_shots_total}
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
          realValue={rr?.cards_total ?? rr?.real_cards_total}
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
          realValue={rr?.totalshots_total ?? rr?.real_totalshots_total}
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
          warning="⚠ Mercado com alta variância — sinais calibrados com NB2"
          realValue={rr?.fouls_total ?? rr?.real_fouls_total}
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
          realValue={rr?.saves_total ?? rr?.real_saves_total}
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
          realValue={rr?.corners_home ?? rr?.real_corners_home}
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
          realValue={rr?.corners_away ?? rr?.real_corners_away}
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
          realValue={rr?.goals_home ?? rr?.real_goals_home}
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
          realValue={rr?.goals_away ?? rr?.real_goals_away}
        />
      </div>

      <BTTSBlock
        homeName={home}
        awayName={away}
        pBtts={r.p_btts}
        details={r.db || { xg_casa: r.xg_casa, xg_fora: r.xg_fora, p_casa_marca: 1 - Math.exp(-r.xg_casa), p_fora_marca: 1 - Math.exp(-r.xg_fora) }}
        realValue={rr}
      />
    </div>
  );
}