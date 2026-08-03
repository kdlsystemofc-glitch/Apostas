import React from "react";
import MarketBlock from "./MarketBlock";
import BTTSBlock from "./BTTSBlock";

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
          title="Escanteios"
          homeName={home}
          awayName={away}
          xHome={r.xc_casa}
          xAway={r.xc_fora}
          xTotal={r.xc_total}
          lines={linhasDinamicas(r.xc_total)}
        />
        <MarketBlock
          icon="⚽"
          title="Gols"
          homeName={home}
          awayName={away}
          xHome={r.xg_casa}
          xAway={r.xg_fora}
          xTotal={r.xg_total}
          lines={linhasDinamicas(r.xg_total)}
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
          xHome={r.xcard_casa}
          xAway={r.xcard_fora}
          xTotal={r.xcard_total}
          lines={linhasDinamicas(r.xcard_total)}
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
          xHome={r.xc_casa}
          xAway={null}
          xTotal={r.xc_casa}
          lines={linhasDinamicas(r.xc_casa)}
        />
        <MarketBlock
          icon="🔲"
          title="Escanteios Fora"
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={r.xc_fora}
          xTotal={r.xc_fora}
          lines={linhasDinamicas(r.xc_fora)}
        />
        <MarketBlock
          icon="⚽"
          title="Gols Casa"
          homeName={home}
          awayName={away}
          xHome={r.xg_casa}
          xAway={null}
          xTotal={r.xg_casa}
          lines={linhasDinamicas(r.xg_casa)}
        />
        <MarketBlock
          icon="⚽"
          title="Gols Fora"
          homeName={home}
          awayName={away}
          xHome={null}
          xAway={r.xg_fora}
          xTotal={r.xg_fora}
          lines={linhasDinamicas(r.xg_fora)}
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