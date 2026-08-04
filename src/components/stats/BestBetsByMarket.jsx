import React from "react";
import { poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS } from "@/lib/predictionEngine";
import { fatorLiga, calibrarProb, buildOverMaps, ajustarBTTS, APP_GLOBALS } from "@/lib/leagueAdjustment";

const colorClasses = {
  green:  "bg-emerald-500 text-white",
  yellow: "bg-amber-400 text-amber-950",
  red:    "bg-red-500 text-white",
  gray:   "bg-slate-200 text-slate-600",
};

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

function bestLine(xTotal, lines, sinalFn = sinalPoisson, dynamic = false, overMap = null) {
  const candidatas = dynamic ? linhasDinamicas(xTotal) : lines;
  if (!candidatas || candidatas.length === 0) return null;

  const linhaPrincipal = Math.floor(xTotal) + 0.5;
  let best = null;
  let bestScore = -Infinity;

  for (const linha of candidatas) {
    const probBruta = poissonOver(xTotal, linha);
    const prob = overMap
      ? calibrarProb(probBruta, overMap, linha)
      : probBruta;
    const sinal = sinalFn(prob);

    // Penaliza linhas muito distantes da linha principal de aposta do mercado real
    const dist = Math.abs(linha - linhaPrincipal);
    const distPenalty = dist * 0.12;
    const signalBonus = sinal.label.includes("FORTE") ? 0.35 : sinal.label !== "NEUTRO" ? 0.18 : 0;
    const score = (1 - distPenalty) + signalBonus + (prob >= 0.5 ? 0.05 : 0);

    if (!best || score > bestScore) {
      bestScore = score;
      best = { linha, prob, sinal, strength: Math.abs(prob - 0.5) };
    }
  }

  return best;
}

export default function BestBetsByMarket({ match, leagueProfile }) {
  const r = match.results;
  if (!r) return null;

  const overMaps = buildOverMaps(leagueProfile);
  const fCorners = fatorLiga(leagueProfile?.avg_corners, APP_GLOBALS.avg_corners);
  const fGols    = fatorLiga(leagueProfile?.avg_goals,   APP_GLOBALS.avg_goals);
  const fCards   = fatorLiga(leagueProfile?.avg_cards,   APP_GLOBALS.avg_cards);
  const pBttsAdj = ajustarBTTS(r.p_btts, leagueProfile);

  const mercados = [
    { icon: "🔲", label: "Escanteios Total",
      x: r.xc_total * fCorners, dynamicLines: true, variance: true,
      overMap: overMaps.corners },
    { icon: "🔲", label: "Escanteios Casa",
      x: r.xc_casa * fCorners, dynamicLines: true },
    { icon: "🔲", label: "Escanteios Fora",
      x: r.xc_fora * fCorners, dynamicLines: true },
    { icon: "⚽", label: "Gols Total",
      x: r.xg_total * fGols, dynamicLines: true, sinalFn: sinalPoissonGols,
      overMap: overMaps.goals },
    { icon: "⚽", label: "Gols Casa",
      x: r.xg_casa * fGols, dynamicLines: true, sinalFn: sinalPoissonGols },
    { icon: "⚽", label: "Gols Fora",
      x: r.xg_fora * fGols, dynamicLines: true, sinalFn: sinalPoissonGols },
    { icon: "🎯", label: "Chutes no Gol",      x: r.xs_total,          dynamicLines: true },
    { icon: "💥", label: "Chutes Totais",      x: r.xtotalshots_total, dynamicLines: true, lowConfidence: true },
    { icon: "🟨", label: "Cartões Total",
      x: r.xcard_total * fCards, dynamicLines: true,
      overMap: overMaps.cards },
    { icon: "🟨", label: `Cartões ${match.home_team}`, x: r.xcard_casa * fCards, dynamicLines: true },
    { icon: "🟨", label: `Cartões ${match.away_team}`, x: r.xcard_fora * fCards, dynamicLines: true },
    { icon: "🎯", label: `Chutes Gol ${match.home_team}`, x: r.xs_casa, dynamicLines: true },
    { icon: "🎯", label: `Chutes Gol ${match.away_team}`, x: r.xs_fora, dynamicLines: true },
    { icon: "🤜", label: "Faltas",               x: r.xfouls_total,      dynamicLines: true, hidden: true },
    { icon: "🧤", label: "Defesas Goleiro Total", x: r.xsaves_total,      dynamicLines: true },
    { icon: "🧤", label: `Defesas Goleiro ${match.home_team}`, x: r.xsaves_casa, dynamicLines: true },
    { icon: "🧤", label: `Defesas Goleiro ${match.away_team}`, x: r.xsaves_fora, dynamicLines: true },
  ];

  const bttsSinal = sinalBTTS(pBttsAdj);

  const rows = mercados
    .filter(m => m.x != null && m.x > 0 && !m.hidden)
    .map(m => {
      const best = bestLine(m.x, m.lines, m.sinalFn || sinalPoisson, m.dynamicLines || false, m.overMap);
      return { ...m, best };
    });

  const sorted = [...rows].sort((a, b) => b.best.strength - a.best.strength);
  const allNeutral = sorted.length > 0 && sorted.every(m => m.best.sinal.label === "NEUTRO");

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-5 py-3 bg-slate-900 border-b">
        <h3 className="font-semibold text-white flex items-center gap-2">
          🔥 Melhor Aposta por Mercado
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Linha com maior probabilidade em cada mercado · Ordenado por força do sinal
        </p>
        {leagueProfile && (
          <p className="text-xs text-slate-400 mt-0.5">
            Calibrado com {leagueProfile.name} ({leagueProfile.matches_sample} jogos)
          </p>
        )}
      </div>

      <div className="divide-y">
        {sorted.map(({ icon, label, x, best, variance, lowConfidence }) => (
          <div key={label} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">{icon}</span>
              <div>
                <p className="text-sm font-medium leading-tight">
                  {label}
                  {variance && (
                    <span className="ml-1.5 text-[10px] text-amber-500 font-normal">alta variância</span>
                  )}
                  {lowConfidence && (
                    <span className="ml-1.5 text-[10px] text-red-500 font-normal">
                      em recalibração — baixa confiabilidade
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  xValor: {x?.toFixed(2)} · Melhor linha: Over {best.linha}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-bold tabular-nums">
                {(best.prob * 100).toFixed(1)}%
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClasses[best.sinal.color]}`}>
                {best.sinal.label}
              </span>
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-lg">🔁</span>
            <div>
              <p className="text-sm font-medium">Ambas Marcam (BTTS)</p>
              <p className="text-xs text-muted-foreground">
                P(Casa marca): {r.db?.p_casa_marca != null ? (r.db.p_casa_marca * 100).toFixed(1) : "—"}% ·
                P(Fora marca): {r.db?.p_fora_marca != null ? (r.db.p_fora_marca * 100).toFixed(1) : "—"}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-sm font-bold tabular-nums">
              {(pBttsAdj * 100).toFixed(1)}%
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${colorClasses[bttsSinal.color]}`}>
              {bttsSinal.label}
            </span>
          </div>
        </div>
      </div>

      {allNeutral ? (
        <div className="px-5 py-4 text-center bg-slate-50 border-t">
          <p className="text-sm text-muted-foreground font-medium">
            Sem sinais fortes para este jogo
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os mercados estão na zona neutra (40-60%). Considere não apostar neste jogo.
          </p>
        </div>
      ) : (
        sorted[0]?.best.sinal.label !== "NEUTRO" && (
          <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-700">
              🏆 Sinal mais forte:
            </span>
            <span className="text-sm font-bold text-emerald-800">
              {sorted[0].label} · Over {sorted[0].best.linha} · {(sorted[0].best.prob * 100).toFixed(1)}%
            </span>
          </div>
        )
      )}
    </div>
  );
}