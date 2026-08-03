import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

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
    
    if (dados.length < 3) return { key, status: "insuficiente", n: dados.length };
    
    const mediaPrev = dados.reduce((s, d) => s + d.p, 0) / dados.length;
    const mediaReal = dados.reduce((s, d) => s + d.r, 0) / dados.length;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.p - d.r), 0) / dados.length;
    
    return {
      key,
      n: dados.length,
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      avaliacao: Math.abs(vies) < 0.3 ? "✓ Calibrado" : Math.abs(vies) < 0.7 ? "⚠ Leve viés" : "✗ Revisar",
      cor: Math.abs(vies) < 0.3 ? "text-emerald-600" : Math.abs(vies) < 0.7 ? "text-amber-600" : "text-red-600",
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const completed = matches.filter(m => m.status === "completed");
  if (completed.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Nenhum jogo com resultado registrado ainda.</p>
        <p className="text-sm text-muted-foreground mt-1">Registre resultados reais nos jogos para ver a calibração.</p>
      </div>
    );
  }

  const BLOCK_SIZE = 10;
  const nBlocos = Math.ceil(completed.length / BLOCK_SIZE);
  const blocos = Array.from({ length: nBlocos }, (_, i) =>
    completed.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold text-sm">Como interpretar</h3>
        <p className="text-xs text-muted-foreground mt-1">
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
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3 bg-slate-900 text-white flex items-center justify-between">
              <span className="font-semibold text-sm">Bloco {i + 1} — Jogos {inicio}–{fim}</span>
              <span className="text-xs text-slate-400">{bloco.length} jogos com resultado</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map(s => (
                  <div key={s.key} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{LABELS[s.key]}</p>
                    {s.status === "insuficiente" ? (
                      <p className="text-xs text-slate-400 mt-1">Dados insuficientes ({s.n} jogos)</p>
                    ) : (
                      <>
                        <div className="flex justify-between mt-2 text-xs">
                          <span className="text-muted-foreground">Previsto</span>
                          <span className="font-medium">{s.mediaPrev}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Real</span>
                          <span className="font-medium">{s.mediaReal}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Viés</span>
                          <span className={`font-medium ${s.cor}`}>{s.vies > 0 ? "+" : ""}{s.vies}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">MAE</span>
                          <span className="font-medium">{s.mae}</span>
                        </div>
                        <p className={`text-xs font-semibold mt-2 ${s.cor}`}>{s.avaliacao}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <div className="rounded-xl border bg-amber-50 border-amber-200 p-4">
        <p className="text-xs text-amber-800">
          <strong>Lembrete:</strong> os pesos do modelo são hipóteses manuais, não calibrados por dados. 
          Com 30+ jogos você já consegue identificar se algum mercado está sistematicamente errado. 
          Com 100+ jogos, vale ajustar os pesos no código.
        </p>
      </div>
    </div>
  );
}