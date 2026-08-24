import React from "react";
import { poissonOver, sinalPoisson, sinalPoissonGols, sinalBTTS, COMMERCIAL_LINES, avaliarPalpiteExplicit } from "@/lib/predictionEngine";
import { CheckCircle2, XCircle } from "lucide-react";

const colorClasses = {
  green:  "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40",
  yellow: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
  red:    "bg-rose-950/80 text-rose-300 border border-rose-500/40",
  gray:   "bg-slate-800 text-slate-300 border border-slate-700",
};

function bestCommercialLine(xTotal, lines, sinalFn = sinalPoisson) {
  if (!lines || lines.length === 0 || xTotal == null) return null;

  const linhaPrincipal = lines.reduce((a, b) => Math.abs(a - xTotal) < Math.abs(b - xTotal) ? a : b);
  const prob = poissonOver(xTotal, linhaPrincipal);
  const oddMinima = prob > 0 ? Math.max(1.01, Math.round((1 / prob) * 100) / 100) : "—";
  const sinal = sinalFn(prob);

  return {
    linha: linhaPrincipal,
    prob,
    oddMinima,
    sinal,
    strength: Math.abs(prob - 0.5),
  };
}

export default function BestBetsByMarket({ match }) {
  const r = match.results;
  if (!r) return null;

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

  const mercados = [
    { icon: "🔲", label: "Escanteios Total", key: "corners_total", x: r.xc_total, lines: COMMERCIAL_LINES.corners_total, realKey: "corners_total", lowConfidence: true },
    { icon: "🔲", label: `Escanteios ${match.home_team}`, key: "corners_casa", x: r.xc_casa, lines: COMMERCIAL_LINES.corners_team, realKey: "corners_home", lowConfidence: true },
    { icon: "🔲", label: `Escanteios ${match.away_team}`, key: "corners_fora", x: r.xc_fora, lines: COMMERCIAL_LINES.corners_team, realKey: "corners_away", lowConfidence: true },
    { icon: "⚽", label: "Gols Total", key: "gols_total", x: r.xg_total, lines: COMMERCIAL_LINES.goals_total, sinalFn: sinalPoissonGols, realKey: "goals_total" },
    { icon: "⚽", label: `Gols ${match.home_team}`, key: "gols_casa", x: r.xg_casa, lines: COMMERCIAL_LINES.goals_team, sinalFn: sinalPoissonGols, realKey: "goals_home" },
    { icon: "⚽", label: `Gols ${match.away_team}`, key: "gols_fora", x: r.xg_fora, lines: COMMERCIAL_LINES.goals_team, sinalFn: sinalPoissonGols, realKey: "goals_away" },
    { icon: "🎯", label: "Chutes no Gol Total", key: "shots_total", x: r.xs_total, lines: COMMERCIAL_LINES.shots_target_total, realKey: "shots_total", lowConfidence: true },
    { icon: "💥", label: "Chutes Totais", key: "totalshots_total", x: r.xtotalshots_total, lines: COMMERCIAL_LINES.total_shots_total, realKey: "totalshots_total", lowConfidence: true },
    { icon: "🟨", label: "Cartões Total", key: "cards_total", x: r.xcard_total, lines: COMMERCIAL_LINES.cards_total, realKey: "cards_total" },
    { icon: "🧤", label: "Defesas Goleiro Total", key: "saves_total", x: r.xsaves_total, lines: COMMERCIAL_LINES.saves_total, realKey: "saves_total" },
    { icon: "🤜", label: "Faltas Total", key: "fouls_total", x: r.xfouls_total, lines: COMMERCIAL_LINES.fouls_total, realKey: "fouls_total", lowConfidence: true, hidden: true },
  ];

  const rows = mercados
    .filter(m => !m.hidden && m.x != null && m.x > 0)
    .map(m => {
      const best = bestCommercialLine(m.x, m.lines, m.sinalFn || sinalPoisson);
      const realVal = rr?.[m.realKey] ?? rr?.[`real_${m.realKey}`];
      const hasReal = realVal !== undefined && realVal !== null && realVal !== "";
      const isGreen = hasReal && best != null ? Number(realVal) > best.linha : null;
      return { ...m, best, realVal, hasReal, isGreen };
    })
    .filter(m => m.best != null);

  const sorted = [...rows].sort((a, b) => b.best.strength - a.best.strength);
  const candidatosSinalForte = sorted.filter(m => !m.lowConfidence);
  const melhorSinalDoJogo = candidatosSinalForte.length > 0 ? candidatosSinalForte[0] : sorted[0];

  const bttsSinal = sinalBTTS(r.p_btts);
  const bttsOddMin = r.p_btts > 0 ? Math.max(1.01, Math.round((1 / r.p_btts) * 100) / 100) : "—";
  const bttsReal = rr?.btts ?? rr?.real_btts;
  const hasBttsReal = bttsReal !== undefined && bttsReal !== null;
  const bttsIsGreen = hasBttsReal ? (r.p_btts >= 0.50 ? Number(bttsReal) === 1 : Number(bttsReal) === 0) : null;

  const eval1x2 = avaliarPalpiteExplicit("1x2", r.pick_1x2 || { palpite: r.pick_1x2?.resultado }, rr);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-xl text-white">
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white flex items-center gap-2 text-base">
            🔥 Melhores Apostas Comerciais por Mercado (Palpites Assumidos V2.1)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-semibold">
            Linhas comerciais reais da Bet365/Pinnacle com verificação de acerto GREEN / RED em todos os mercados
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {/* Mercado 1X2 Em Destaque */}
        {r.pick_1x2 && (
          <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-950/30 hover:bg-emerald-950/50 transition-colors border-b border-emerald-500/20">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">🏆</span>
              <div>
                <p className="text-sm font-black text-emerald-400 leading-tight">
                  Resultado 1X2 — {r.pick_1x2.resultado}
                </p>
                <p className="text-xs text-slate-300 font-semibold">
                  Pick Estrita do Modelo (Vitória Mandante / Empate / Vitória Visitante)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              {eval1x2.status !== "PENDENTE" && (
                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                  eval1x2.isGreen ? "bg-emerald-600 text-white border-emerald-400" : "bg-rose-600 text-white border-rose-400"
                }`}>
                  {eval1x2.isGreen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  {eval1x2.isGreen ? "GREEN" : "RED"}
                </span>
              )}
              <div className="text-right tabular-nums">
                <span className="text-sm font-black text-emerald-400 block">
                  {(r.pick_1x2.prob * 100).toFixed(1)}%
                </span>
                <span className="text-xs text-slate-400">
                  Odd Justa: <strong className="text-white font-bold">{r.pick_1x2.odd_minima}</strong>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mercado BTTS Em Destaque */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-950/60 hover:bg-slate-800/40 transition-colors">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-lg">🔁</span>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight">
                Ambas Marcam (BTTS) — {r.p_btts >= 0.50 ? "SIM" : "NÃO"}
              </p>
              <p className="text-xs text-slate-400 font-semibold">
                Matriz Bivariada Dixon-Coles
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {hasBttsReal && (
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                bttsIsGreen ? "bg-emerald-600 text-white border-emerald-400" : "bg-rose-600 text-white border-rose-400"
              }`}>
                {bttsIsGreen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {bttsIsGreen ? "GREEN" : "RED"}
              </span>
            )}
            <div className="text-right tabular-nums">
              <span className="text-sm font-extrabold text-emerald-400 block">
                {(r.p_btts * 100).toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400">
                Odd Justa: <strong className="text-white font-bold">{bttsOddMin}</strong>
              </span>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${colorClasses[bttsSinal.color]}`}>
              {bttsSinal.label}
            </span>
          </div>
        </div>

        {/* Demais Mercados Ordenados */}
        {sorted.map(m => (
          <div key={m.label} className="flex flex-col px-5 py-3 hover:bg-slate-800/40 transition-colors gap-1 border-t border-slate-800/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">{m.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-100 leading-tight flex items-center gap-1.5 flex-wrap">
                    <span>Over {m.best.linha} {m.label}</span>
                    {m.lowConfidence && (
                      <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-300 shrink-0">
                        ⚠ EM ESTUDO
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 font-semibold tabular-nums mt-0.5">
                    Projeção: <strong className="text-blue-400 font-bold">{m.x}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                {m.hasReal && (
                  <span className={`text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1 border ${
                    m.isGreen ? "bg-emerald-600 text-white border-emerald-400" : "bg-rose-600 text-white border-rose-400"
                  }`}>
                    {m.isGreen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {m.isGreen ? `GREEN (${m.realVal})` : `RED (${m.realVal})`}
                  </span>
                )}
                <div className="text-right tabular-nums">
                  <span className="text-sm font-extrabold text-emerald-400 block">
                    {(m.best.prob * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">
                    Odd Justa: <strong className="text-white font-bold">{m.best.oddMinima}</strong>
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-extrabold ${colorClasses[m.best.sinal.color]}`}>
                  {m.best.sinal.label}
                </span>
              </div>
            </div>

            {m.lowConfidence && (
              <p className="text-[11px] text-amber-400/90 mt-1 leading-snug font-sans bg-amber-950/40 p-2 rounded border border-amber-500/30">
                Este mercado está sob validação estatística contínua. Com os dados disponíveis até agora (156 jogos), não foi possível confirmar sinal preditivo confiável fora da amostra de treino. A projeção ainda é exibida como informação, mas não deve ser tratada como uma recomendação forte de aposta.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}