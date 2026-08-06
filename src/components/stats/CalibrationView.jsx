import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";

function calcBloco(matches) {
  function buildRealSum(homeKey, awayKey) {
    return m => {
      const rr = m.real_results;
      if (rr?.[homeKey] === undefined && rr?.[awayKey] === undefined) return null;
      return (Number(rr?.[homeKey]) || 0) + (Number(rr?.[awayKey]) || 0);
    };
  }

  const mercados = [
    { key: "corners",    prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away") },
    { key: "gols",       prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away") },
    { key: "cartoes",    prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away") },
    { key: "chutesgol",  prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away") },
    { key: "faltas",     prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away") },
    { key: "saves",      prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away") },
    { key: "totalshots", prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away") },
    { key: "btts", prev: m => m.results?.p_btts, real: m => {
      const rr = m.real_results;
      if (rr?.btts === undefined) return null;
      return Number(rr.btts);
    }},
  ];

  return mercados.map(({ key, prev, real }) => {
    const dados = matches
      .map(m => ({ p: prev(m), r: real(m) }))
      .filter(d => d.p !== null && d.p !== undefined && d.r !== null && d.r !== undefined);

    if (dados.length === 0) {
      return { key, n: 0, status: "insuficiente" };
    }

    const mediaPrev = dados.reduce((s, d) => s + d.p, 0) / dados.length;
    const mediaReal = dados.reduce((s, d) => s + d.r, 0) / dados.length;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.p - d.r), 0) / dados.length;

    // Sucesso dos sinais (se real acertou a linha principal prevista)
    let acertos = 0;
    let avaliados = 0;
    for (const d of dados) {
      if (key === "btts") {
        const predBTTS = d.p >= 0.5 ? 1 : 0;
        if (predBTTS === d.r) acertos++;
        avaliados++;
      } else {
        const linhaPrincipal = Math.floor(d.p) + 0.5;
        const acertoOver = d.r > linhaPrincipal;
        const previsaoOver = d.p >= linhaPrincipal;
        if (previsaoOver === acertoOver) acertos++;
        avaliados++;
      }
    }
    const winRate = avaliados > 0 ? ((acertos / avaliados) * 100).toFixed(0) : 0;

    return {
      key,
      n: dados.length,
      status: "ok",
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      winRate,
      avaliacao: Math.abs(vies) < 0.3 ? "✓ Calibrado" : Math.abs(vies) < 0.7 ? "⚠ Leve viés" : "✗ Revisar",
      cor: Math.abs(vies) < 0.3 ? "text-emerald-400 font-bold" : Math.abs(vies) < 0.7 ? "text-amber-400 font-bold" : "text-rose-400 font-bold",
    };
  });
}

const LABELS = {
  corners: "Escanteios",
  gols: "Gols",
  cartoes: "Cartões",
  chutesgol: "Chutes no Gol",
  faltas: "Faltas",
  saves: "Defesas Goleiro",
  totalshots: "Chutes Totais",
  btts: "BTTS",
};

export default function CalibrationView() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Match.list("-date", 200).then(setMatches).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 p-6 bg-slate-900/80 rounded-xl border border-slate-800">
        <Skeleton className="h-8 w-3/4 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
      </div>
    );
  }

  const completed = matches.filter(m => m.status === "completed");
  if (completed.length === 0) {
    return (
      <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800 text-white">
        <p className="text-slate-300 font-bold text-base">Nenhum jogo com resultado registrado ainda.</p>
        <p className="text-xs text-slate-400 mt-1">Registre resultados reais nos jogos para visualizar o relatório de calibração.</p>
      </div>
    );
  }

  const BLOCK_SIZE = 10;
  const nBlocos = Math.ceil(completed.length / BLOCK_SIZE);
  const blocos = Array.from({ length: nBlocos }, (_, i) =>
    completed.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
  );

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-5 shadow-xl">
        <h3 className="font-bold text-sm text-emerald-400">Como interpretar os indicadores</h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          <strong>Viés</strong> = previsão média − real médio. Positivo = modelo superestima, negativo = subestima.<br/>
          <strong>MAE</strong> = erro absoluto médio (quanto o modelo erra em unidades reais por jogo).<br/>
          <strong>Calibrado</strong> se viés &lt; 0.30 · <strong>Leve viés</strong> se 0.30–0.70 · <strong>Revisar pesos</strong> se &gt; 0.70
        </p>
      </div>

      {blocos.map((bloco, i) => {
        const stats = calcBloco(bloco);
        const inicio = i * BLOCK_SIZE + 1;
        const fim = Math.min((i + 1) * BLOCK_SIZE, completed.length);
        return (
          <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md overflow-hidden shadow-xl">
            <div className="px-5 py-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <span className="font-bold text-sm text-slate-100">Bloco {i + 1} — Jogos {inicio}–{fim}</span>
              <span className="text-xs font-semibold text-slate-400">{bloco.length} jogos avaliados</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(s => (
                  <div key={s.key} className="rounded-lg bg-slate-950/60 p-3.5 border border-slate-800/80">
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{LABELS[s.key]}</p>
                    {s.status === "insuficiente" ? (
                      <p className="text-xs text-slate-500 mt-1">Dados insuficientes ({s.n} jogos)</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-xs tabular-nums font-semibold">
                        <div className="flex justify-between text-slate-300">
                          <span>Previsto</span>
                          <span className="font-bold text-white">{s.mediaPrev}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Real</span>
                          <span className="font-bold text-white">{s.mediaReal}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>Viés</span>
                          <span className={s.cor}>{s.vies > 0 ? "+" : ""}{s.vies}</span>
                        </div>
                        <div className="flex justify-between text-slate-300">
                          <span>MAE</span>
                          <span className="font-bold text-white">{s.mae}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-800/60 pt-1 text-slate-300">
                          <span>Taxa Acerto</span>
                          <span className="font-extrabold text-emerald-400">{s.winRate}%</span>
                        </div>
                        <p className={`text-[11px] font-extrabold mt-1.5 ${s.cor}`}>{s.avaliacao}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4">
        <p className="text-xs text-amber-300 font-medium">
          <strong>Lembrete de Calibração V2:</strong> O modelo utiliza parâmetros bayesianos calibrados. 
          Com 30+ jogos registrados, avalie o viés do mercado desejado para confirmar a rentabilidade de longo prazo.
        </p>
      </div>
    </div>
  );
}