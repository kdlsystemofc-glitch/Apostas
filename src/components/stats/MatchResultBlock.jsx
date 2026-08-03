import React from "react";

export default function MatchResultBlock({ match }) {
  const r = match.results;
  if (!r?.p_casa_vence) return null;

  const home = match.home_team;
  const away = match.away_team;
  const barWidth = (p) => `${Math.round(p * 100)}%`;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 text-white">
        <h3 className="font-semibold flex items-center gap-2">
          🏆 Resultado Esperado (1X2)
        </h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex rounded-full overflow-hidden h-10 text-xs font-bold">
          <div className="bg-emerald-500 text-white flex items-center justify-center"
               style={{ width: barWidth(r.p_casa_vence) }}>
            {(r.p_casa_vence * 100).toFixed(1)}%
          </div>
          <div className="bg-slate-400 text-white flex items-center justify-center"
               style={{ width: barWidth(r.p_empate) }}>
            {(r.p_empate * 100).toFixed(1)}%
          </div>
          <div className="bg-red-500 text-white flex items-center justify-center"
               style={{ width: barWidth(r.p_fora_vence) }}>
            {(r.p_fora_vence * 100).toFixed(1)}%
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium text-emerald-700">{home}</span>
          <span className="text-muted-foreground">Empate</span>
          <span className="font-medium text-red-600">{away}</span>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Placares mais prováveis
          </p>
          <div className="grid grid-cols-5 gap-2">
            {r.placares_top5?.map((p, i) => (
              <div key={i} className="rounded-lg bg-slate-50 p-2.5 text-center">
                <p className="text-lg font-bold">{p.placar}</p>
                <p className="text-xs text-muted-foreground">{(p.prob * 100).toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
