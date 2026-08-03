import React from "react";

const labelMap = {
  shots_on_target: "Chutes no Gol",
  shots_in_box: "Chutes na Área",
  big_chance_missed: "Big Chance Perdida",
  crosses: "Cruzamentos",
  touches_opp_box: "Toques na Área Adv.",
  gk_saves: "Defesas do Goleiro",
  clearances: "Cortes Defensivos",
  shots_ced: "Chutes Cedidos",
};

function DetailRow({ label, homeVal, awayVal, highlighted }) {
  return (
    <div className={`grid grid-cols-3 text-sm ${highlighted ? "bg-blue-50 font-semibold" : "hover:bg-slate-50"}`}>
      <div className="px-4 py-2.5 text-slate-700">{label}</div>
      <div className="px-4 py-2.5 text-center tabular-nums">{typeof homeVal === "number" ? homeVal.toFixed(4) : homeVal}</div>
      <div className="px-4 py-2.5 text-center tabular-nums">{typeof awayVal === "number" ? awayVal.toFixed(4) : awayVal}</div>
    </div>
  );
}

export default function CornerDetails({ match }) {
  const dc = match.results.dc;
  const df = match.results.df;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 text-white">
        <h3 className="font-semibold">Detalhamento — Escanteios</h3>
      </div>

      <div className="grid grid-cols-3 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b bg-slate-50">
        <div className="px-4 py-2.5">Fator</div>
        <div className="px-4 py-2.5 text-center">{match.home_team} (casa)</div>
        <div className="px-4 py-2.5 text-center">{match.away_team} (fora)</div>
      </div>

      <div className="divide-y">
        <DetailRow label="Âncora (base balanceada)" homeVal={dc.base} awayVal={df.base} />
        <DetailRow label="Índice Ofensivo" homeVal={dc.indice_ofensivo} awayVal={df.indice_ofensivo} />
        <DetailRow label="Índice Defensivo Adversário" homeVal={dc.indice_defensivo} awayVal={df.indice_defensivo} />
        <DetailRow label="Índice Composto" homeVal={dc.indice_composto} awayVal={df.indice_composto} />
        <DetailRow label="xCorners Final" homeVal={match.results.xc_casa} awayVal={match.results.xc_fora} highlighted />
      </div>

      {dc.detalhes_of && (
        <>
          <div className="px-5 py-2.5 bg-blue-50 border-y">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Fatores Ofensivos</p>
          </div>
          <div className="divide-y">
            {Object.entries(dc.detalhes_of).map(([key, [peso, valHome]]) => {
              const valAway = df.detalhes_of?.[key]?.[1] ?? 1.0;
              return (
                <DetailRow
                  key={key}
                  label={`${labelMap[key] || key} (peso ${peso})`}
                  homeVal={valHome}
                  awayVal={valAway}
                />
              );
            })}
          </div>
        </>
      )}

      {dc.detalhes_def && (
        <>
          <div className="px-5 py-2.5 bg-orange-50 border-y">
            <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">Fatores Defensivos</p>
          </div>
          <div className="divide-y">
            {Object.entries(dc.detalhes_def).map(([key, [peso, valHome]]) => {
              const valAway = df.detalhes_def?.[key]?.[1] ?? 1.0;
              return (
                <DetailRow
                  key={key}
                  label={`${labelMap[key] || key} (peso ${peso})`}
                  homeVal={valHome}
                  awayVal={valAway}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}