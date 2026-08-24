import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { parseStatsHubText, analisarJogo } from "@/lib/predictionEngine";
import {
  CALIBRATION_COEFFICIENTS,
  setCalibrationCoefficients,
  fitOLS,
} from "@/lib/calibrationLayer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, Sliders, CheckCircle2, ShieldAlert, BarChart3 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function erf(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCDF(z) {
  return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function testeBinomial(acertos, total, p_null = 0.5) {
  if (total === 0) return { p_hat: 0, z: 0, p_valor: 1, significativo: false };
  const p_hat = acertos / total;
  const se = Math.sqrt(p_null * (1 - p_null) / total);
  const z = (p_hat - p_null) / (se || 1);
  const p_valor = 1 - normalCDF(z);
  return { p_hat, z, p_valor, significativo: p_valor < 0.05 };
}

function fixLegacyStats(statsObj) {
  if (!statsObj || typeof statsObj !== "object") return statsObj;
  const fixed = {};
  for (const [key, val] of Object.entries(statsObj)) {
    if (val && typeof val === "object" && val.t !== undefined && val.c !== undefined) {
      if (val.t > val.c) {
        const teamMade = val.c;
        const conceded = Math.max(0, val.t - val.c);
        fixed[key] = { t: teamMade, c: conceded };
      } else {
        fixed[key] = val;
      }
    } else {
      fixed[key] = val;
    }
  }
  return fixed;
}

function calcBloco(matches) {
  function buildRealSum(homeKey, awayKey) {
    return m => {
      const rr = m.real_results;
      if (!rr) return null;
      const h = rr[homeKey] ?? rr[`real_${homeKey}`];
      const a = rr[awayKey] ?? rr[`real_${awayKey}`];
      if (h === undefined && a === undefined) return null;
      return (Number(h) || 0) + (Number(a) || 0);
    };
  }

  const mercados = [
    { key: "corners",    prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away"), lowConfidence: true },
    { key: "gols",       prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away") },
    { key: "cartoes",    prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away") },
    { key: "chutesgol",  prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away"), lowConfidence: true },
    { key: "faltas",     prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away"), lowConfidence: true },
    { key: "saves",      prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away") },
    { key: "totalshots", prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away"), lowConfidence: true },
    { key: "btts", prev: m => m.results?.p_btts, real: m => {
      const rr = m.real_results;
      if (!rr) return null;
      const b = rr.btts ?? rr.real_btts;
      if (b === undefined || b === null) return null;
      return Number(b);
    }},
  ];

  return mercados.map(({ key, prev, real, lowConfidence }) => {
    const dados = matches
      .map(m => ({ p: prev(m), r: real(m) }))
      .filter(d => d.p !== null && d.p !== undefined && d.r !== null && d.r !== undefined);

    if (dados.length === 0) {
      return { key, n: 0, status: "insuficiente", lowConfidence };
    }

    const mediaPrev = dados.reduce((s, d) => s + d.p, 0) / dados.length;
    const mediaReal = dados.reduce((s, d) => s + d.r, 0) / dados.length;
    const vies = mediaPrev - mediaReal;
    const mae = dados.reduce((s, d) => s + Math.abs(d.p - d.r), 0) / dados.length;

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
      lowConfidence,
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      winRate,
      avaliacao: lowConfidence ? "⚠ EM ESTUDO" : Math.abs(vies) < 0.3 ? "✓ Calibrado" : Math.abs(vies) < 0.7 ? "⚠ Leve viés" : "✗ Revisar",
      cor: lowConfidence ? "text-amber-400 font-bold" : Math.abs(vies) < 0.3 ? "text-emerald-400 font-bold" : Math.abs(vies) < 0.7 ? "text-amber-400 font-bold" : "text-rose-400 font-bold",
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

const OLS_MARKETS_MAP = [
  { key: "corners_total",   name: "Escanteios Total", rawKey: "xc_total_bruto",  homeRealKey: "corners_home", awayRealKey: "corners_away" },
  { key: "goals_total",     name: "Gols Total",       rawKey: "xg_total_bruto",  homeRealKey: "goals_home",   awayRealKey: "goals_away" },
  { key: "cards_total",     name: "Cartões Total",    rawKey: "xcard_total_bruto", homeRealKey: "cards_home", awayRealKey: "cards_away" },
  { key: "shots_on_target", name: "Chutes no Gol",    rawKey: "xs_total_bruto",  homeRealKey: "shots_home",   awayRealKey: "shots_away" },
  { key: "fouls_total",     name: "Faltas Total",     rawKey: "xfouls_total_bruto", homeRealKey: "fouls_home", awayRealKey: "fouls_away" },
  { key: "saves_total",     name: "Defesas Goleiro",  rawKey: "xsaves_total_bruto", homeRealKey: "saves_home", awayRealKey: "saves_away" },
  { key: "total_shots",     name: "Chutes Totais",    rawKey: "xtotalshots_total_bruto", homeRealKey: "totalshots_home", awayRealKey: "totalshots_away" },
];

export default function CalibrationView() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [evalResults, setEvalResults] = useState(null);
  const { toast } = useToast();

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Match.list("-created_date", 500);
      setMatches(data);
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleReevaluateReliability = () => {
    const completed = matches.filter(m => m.status === "completed" || m.real_results);
    if (completed.length < 20) {
      toast({ title: "Amostra Insuficiente", description: "Mínimo 20 partidas necessárias para split treino/teste.", variant: "destructive" });
      return;
    }

    // Split cronológico 80/20
    const sorted = [...completed].sort((a, b) => new Date(a.date || a.created_date) - new Date(b.date || b.created_date));
    const trainSize = Math.floor(sorted.length * 0.80);
    const trainSet = sorted.slice(0, trainSize);
    const testSet = sorted.slice(trainSize);

    function buildRealSum(homeKey, awayKey) {
      return m => {
        const rr = m.real_results;
        if (!rr) return null;
        const h = rr[homeKey] ?? rr[`real_${homeKey}`];
        const a = rr[awayKey] ?? rr[`real_${awayKey}`];
        if (h === undefined && a === undefined) return null;
        return (Number(h) || 0) + (Number(a) || 0);
      };
    }

    const problemMarkets = [
      { key: "corners_total", name: "Escanteios Total", prev: m => m.results?.xc_total, real: buildRealSum("corners_home", "corners_away") },
      { key: "shots_on_target", name: "Chutes no Gol", prev: m => m.results?.xs_total, real: buildRealSum("shots_home", "shots_away") },
      { key: "fouls_total", name: "Faltas Total", prev: m => m.results?.xfouls_total, real: buildRealSum("fouls_home", "fouls_away") },
      { key: "total_shots", name: "Chutes Totais", prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away") },
    ];

    const results = problemMarkets.map(mDef => {
      const trainData = trainSet.map(m => ({ p: mDef.prev(m), r: mDef.real(m) })).filter(d => d.p != null && d.r != null);
      const testData = testSet.map(m => ({ p: mDef.prev(m), r: mDef.real(m) })).filter(d => d.p != null && d.r != null);

      let acertosTest = 0;
      for (const d of testData) {
        const linha = Math.floor(d.p) + 0.5;
        if ((d.p >= linha) === (d.r > linha)) acertosTest++;
      }

      const binTest = testeBinomial(acertosTest, testData.length);
      const winRateTest = testData.length > 0 ? (acertosTest / testData.length) * 100 : 0;

      // R² no Teste
      const meanYTest = testData.reduce((s, d) => s + d.r, 0) / (testData.length || 1);
      const ssRes = testData.reduce((s, d) => s + (d.r - d.p) ** 2, 0);
      const ssTot = testData.reduce((s, d) => s + (d.r - meanYTest) ** 2, 0);
      const r2Test = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

      const podePromover = r2Test > 0.10 && binTest.significativo;

      return {
        key: mDef.key,
        name: mDef.name,
        nTrain: trainData.length,
        nTest: testData.length,
        r2Test: r2Test.toFixed(3),
        winRateTest: winRateTest.toFixed(1),
        pHat: (binTest.p_hat * 100).toFixed(1),
        pValor: binTest.p_valor.toFixed(4),
        significativo: binTest.significativo,
        podePromover,
        recomendacao: podePromover ? "🚀 ELEGÍVEL PARA PROMOÇÃO A CONFIÁVEL" : "⚠ MANTER EM ESTUDO (SEM SINAL RELEVANTE)",
      };
    });

    setEvalResults(results);
    toast({ title: "Reavaliação Concluída!", description: `Testes binomiais e OLS out-of-sample calculados.` });
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    try {
      const all = await base44.entities.Match.list("-created_date", 500);
      let count = 0;
      for (const m of all) {
        count++;
        setProgressMsg(`Recalculando jogo ${count} de ${all.length}: ${m.home_team} vs ${m.away_team}`);

        let homeStats = m.home_stats;
        let awayStats = m.away_stats;

        if (typeof m.home_text === "string" && m.home_text.trim().length > 10) {
          homeStats = parseStatsHubText(m.home_text);
        } else {
          homeStats = fixLegacyStats(m.home_stats);
        }

        if (typeof m.away_text === "string" && m.away_text.trim().length > 10) {
          awayStats = parseStatsHubText(m.away_text);
        } else {
          awayStats = fixLegacyStats(m.away_stats);
        }

        const newResults = analisarJogo(homeStats, awayStats);

        await base44.entities.Match.update(m.id, {
          home_stats: homeStats,
          away_stats: awayStats,
          results: newResults,
        });
      }

      toast({ title: "Recálculo concluído!", description: `${all.length} jogos recalculados com sucesso.` });
      await loadMatches();
    } catch (err) {
      toast({ title: "Erro ao recalcular", description: err.message, variant: "destructive" });
    } finally {
      setRecalculating(false);
      setProgressMsg("");
    }
  };

  const handleExportReport = () => {
    const completed = matches.filter(m => m.status === "completed" || m.real_results);
    const overallStats = calcBloco(completed);

    const reportData = {
      data_exportacao: new Date().toISOString(),
      total_jogos_analisados: completed.length,
      camada2_ols_ativa: false,
      mercados: overallStats.map(s => ({
        mercado: LABELS[s.key] || s.key,
        amostra_jogos: s.n,
        em_estudo: s.lowConfidence || false,
        media_prevista: s.mediaPrev,
        media_real: s.mediaReal,
        vies: s.vies,
        mae: s.mae,
        win_rate: `${s.winRate}%`,
        status: s.avaliacao,
      })),
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_calibracao_sports_predictor_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Relatório exportado!", description: "Arquivo JSON baixado com sucesso." });
  };

  if (loading) {
    return (
      <div className="space-y-3 p-6 bg-slate-900/80 rounded-xl border border-slate-800">
        <Skeleton className="h-8 w-3/4 bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
        <Skeleton className="h-32 w-full bg-slate-800" />
      </div>
    );
  }

  const completed = matches.filter(m => m.status === "completed" || m.real_results);

  const BLOCK_SIZE = 10;
  const nBlocos = Math.ceil(completed.length / BLOCK_SIZE);
  const blocos = Array.from({ length: nBlocos }, (_, i) =>
    completed.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
  );

  return (
    <div className="space-y-6 text-white">
      {/* Botões de Ação Global (Recalcular, Exportar & Reavaliar Confiabilidade) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 rounded-xl border border-slate-800 shadow-xl">
        <div>
          <h3 className="font-extrabold text-base text-white">Painel de Calibração Estatística V2.3</h3>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Total no banco: {matches.length} jogos ({completed.length} com resultado real)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleReevaluateReliability}
            className="bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-100" />
            Reavaliar Confiabilidade dos Mercados
          </Button>
          <Button
            onClick={handleRecalculateAll}
            disabled={recalculating}
            className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculando..." : "Recalcular Todos (Massa)"}
          </Button>
          <Button
            onClick={handleExportReport}
            disabled={completed.length === 0}
            variant="outline"
            className="border-slate-700 bg-slate-950 text-white hover:bg-slate-800 font-extrabold text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Painel de Reavaliação de Confiabilidade (Teste Binomial + OLS Out-of-Sample) */}
      {evalResults && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-5 shadow-xl space-y-4">
          <div>
            <h4 className="font-extrabold text-sm text-amber-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Reavaliação de Confiabilidade dos Mercados (Teste Binomial + Out-of-Sample)
            </h4>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Avaliação out-of-sample (split cronológico 80% treino / 20% teste). Promoção para "Confiável" exige R² &gt; 0.10 e teste binomial com p-valor &lt; 0.05.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs text-left text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-extrabold text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-2.5">Mercado</th>
                  <th className="p-2.5">Treino / Teste (N)</th>
                  <th className="p-2.5">R² no Teste</th>
                  <th className="p-2.5">Acerto Teste (%)</th>
                  <th className="p-2.5">Teste Binomial (p-valor)</th>
                  <th className="p-2.5">Recomendação Estatística</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {evalResults.map(res => (
                  <tr key={res.key} className="hover:bg-slate-900/60">
                    <td className="p-2.5 font-sans font-extrabold text-white">{res.name}</td>
                    <td className="p-2.5 text-slate-400">{res.nTrain} / {res.nTest} jogos</td>
                    <td className={`p-2.5 font-bold ${Number(res.r2Test) > 0.10 ? "text-emerald-400" : "text-rose-400"}`}>{res.r2Test}</td>
                    <td className="p-2.5 font-bold text-white">{res.winRateTest}%</td>
                    <td className={`p-2.5 font-bold ${res.significativo ? "text-emerald-400" : "text-amber-400"}`}>{res.pValor} {res.significativo ? "(✓ Sig.)" : "(ns)"}</td>
                    <td className={`p-2.5 font-sans font-bold text-[11px] ${res.podePromover ? "text-emerald-400" : "text-amber-400"}`}>{res.recomendacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {recalculating && (
        <div className="p-4 bg-blue-950/80 border border-blue-500/50 rounded-xl text-xs font-bold text-blue-200 animate-pulse">
          ⏳ {progressMsg}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-5 shadow-xl">
        <h3 className="font-bold text-sm text-emerald-400">Como interpretar os indicadores</h3>
        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
          <strong>Viés</strong> = previsão média − real médio. Positivo = modelo superestima, negativo = subestima.<br/>
          <strong>MAE</strong> = erro absoluto médio (quanto o modelo erra em unidades reais por jogo).<br/>
          <strong>Calibrado</strong> se viés &lt; 0.30 · <strong>EM ESTUDO</strong> se mercado sob validação contínua (lowConfidence).
        </p>
      </div>

      {completed.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800 text-white">
          <p className="text-slate-300 font-bold text-base">Nenhum jogo com resultado registrado ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Registre resultados reais nos jogos para visualizar o relatório de calibração.</p>
        </div>
      ) : (
        blocos.map((bloco, i) => {
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
        })
      )}
    </div>
  );
}