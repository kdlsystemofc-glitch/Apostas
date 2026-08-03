import React from "react";
import MarketBlock from "./MarketBlock";
import BTTSBlock from "./BTTSBlock";
import { sinalPoissonGols } from "@/lib/predictionEngine";
import { fatorLiga, APP_GLOBALS } from "@/lib/leagueAdjustment";

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

export default function MatchResults({ match, leagueProfile }) {
  const r = match.results;
  const home = match.home_team;
  const away = match.away_team;

  const fC = fatorLiga(leagueProfile?.avg_corners, APP_GLOBALS.avg_corners);
  const fG = fatorLiga(leagueProfile?.avg_goals,   APP_GLOBALS.avg_goals);
  const fK = fatorLiga(leagueProfile?.avg_cards,    APP_GLOBALS.avg_cards);

  return (
    <div className="space-y-5">
      <div className="text-center pb-2">
        <h2 className="text-2xl font-bold tracking-tight">{home} <span className="text-muted-foreground font-normal">vs</span> {away}</h2>
        {match.date && <p className="text-sm text-muted-foreground mt-0.5">{match.date}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MarketBlock
          icon="🔲"
          title="Escanteios"
          homeName={home}
          awayName={away}
          xHome={Math.round(r.xc_casa * fC * 100)/100}
          xAway={Math.round(r.xc_fora * fC * 100)/100}
          xTotal={Math.round(r.xc_total * fC * 100)/100}
          lines={linhasDinamicas(r.xc_total * fC)}
        />
        <MarketBlock
          icon="⚽"
          title="Gols"
          homeName={home}
          awayName={away}
          xHome={Math.round(r.xg_casa * fG * 100)/100}
          xAway={Math.round(r.xg_fora * fG * 100)/100}
          xTotal={Math.round(r.xg_total * fG * 100)/100}
          lines={linhasDinamicas(r.xg_total * fG)}
          sinalFn={sinalPoissonGols}
        />
        <MarketBlock
          icon="🎯"
          title="Chutes no Gol"
          homeName={home}
          awayName={away}
          xHome={r.xs_casa}
          xAway={r.xs_fora}
          xTotal={r.xs_total}
          lines={linhasDinamicas(r.xs_total)}
        />
        <MarketBlock
          icon="🟨"
          title="Cartões"
          homeName={home}
          awayName={away}
          xHome={Math.round(r.xcard_casa * fK * 100)/100}
          xAway={Math.round(r.xcard_fora * fK * 100)/100}
          xTotal={Math.round(r.xcard_total * fK * 100)/100}
          lines={linhasDinamicas(r.xcard_total * fK)}
        />
        <MarketBlock
          icon="💥"
          title="Chutes Totais"
          homeName={home}
          awayName={away}
          xHome={r.xtotalshots_casa}
          xAway={r.xtotalshots_fora}
          xTotal={r.xtotalshots_total}
          lines={linhasDinamicas(r.xtotalshots_total)}
        />
        <MarketBlock
          icon="🤜"
          title="Faltas"
          homeName={home}
          awayName={away}
          xHome={r.xfouls_casa}
          xAway={r.xfouls_fora}
          xTotal={r.xfouls_total}
          lines={linhasDinamicas(r.xfouls_total)}
          warning="⚠ Mercado com alta variância"
        />
        <MarketBlock
          icon="🧤"
          title="Defesas do Goleiro"
          homeName={home}
          awayName={away}
          xHome={r.xsaves_casa}
          xAway={r.xsaves_fora}
          xTotal={r.xsaves_total}
          lines={linhasDinamicas(r.xsaves_total)}
        />
        <MarketBlock
          icon="🔲"
          title="Escanteios Casa"
          homeName={home}
          awayName={away}
          xHome={Math.round(r.xc_casa * fC * 100)/100}
          xAway={null}
          xTotal={Math.round(r.xc_casa * fC * 100)/100}
          lines={linhasDinamicas(r.xc_casa * fC)}
        />
        <MarketBlock
          icon="🔲"
          title="Escanteios Fora"
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={Math.round(r.xc_fora * fC * 100)/100}
          xTotal={Math.round(r.xc_fora * fC * 100)/100}
          lines={linhasDinamicas(r.xc_fora * fC)}
        />
        <MarketBlock
          icon="⚽"
          title="Gols Casa"
          homeName={home}
          awayName={away}
          xHome={Math.round(r.xg_casa * fG * 100)/100}
          xAway={null}
          xTotal={Math.round(r.xg_casa * fG * 100)/100}
          lines={linhasDinamicas(r.xg_casa * fG)}
          sinalFn={sinalPoissonGols}
        />
        <MarketBlock
          icon="⚽"
          title="Gols Fora"
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={Math.round(r.xg_fora * fG * 100)/100}
          xTotal={Math.round(r.xg_fora * fG * 100)/100}
          lines={linhasDinamicas(r.xg_fora * fG)}
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