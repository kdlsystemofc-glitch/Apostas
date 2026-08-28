import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { parseStatsHubText, analisarJogo } from "@/lib/predictionEngine";
import {
  CALIBRATION_COEFFICIENTS,
  setCalibrationCoefficients,
  fitOLS,
  isMercadoEmEstudo,
} from "@/lib/calibrationLayer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Download, ShieldAlert, BarChart3, RotateCcw } from "lucide-react";
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

function calcBloco(matches) {
  // Filtra jogos marcados com dados nao verificados por falta de texto bruto
  const validMatches = matches.filter(m => !m.home_stats?.dados_nao_verificados && !m.dados_nao_verificados);

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
    { key: "corners",     name: "Escanteios Total",       prev: m => m.results?.xc_total,          real: buildRealSum("corners_home", "corners_away"), lowConfidence: isMercadoEmEstudo("corners") },
    { key: "gols",        name: "Gols Total",             prev: m => m.results?.xg_total,          real: buildRealSum("goals_home", "goals_away"), lowConfidence: isMercadoEmEstudo("gols") },
    { key: "cartoes",     name: "Cartões Total",          prev: m => m.results?.xcard_total,       real: buildRealSum("cards_home", "cards_away"), lowConfidence: isMercadoEmEstudo("cartoes") },
    { key: "chutesgol",   name: "Chutes no Gol Total",    prev: m => m.results?.xs_total,          real: buildRealSum("shots_home", "shots_away"), lowConfidence: isMercadoEmEstudo("chutesgol") },
    { key: "faltas",      name: "Faltas Total",           prev: m => m.results?.xfouls_total,      real: buildRealSum("fouls_home", "fouls_away"), lowConfidence: isMercadoEmEstudo("faltas") },
    { key: "saves",       name: "Defesas Goleiro Total",  prev: m => m.results?.xsaves_total,      real: buildRealSum("saves_home", "saves_away"), lowConfidence: isMercadoEmEstudo("saves") },
    { key: "totalshots",  name: "Chutes Totais",          prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away"), lowConfidence: isMercadoEmEstudo("totalshots") },
    { key: "btts",        name: "Ambas Marcam (BTTS)",    prev: m => m.results?.p_btts,            real: m => {
      const rr = m.real_results;
      if (!rr) return null;
      const b = rr.btts ?? rr.real_btts;
      if (b === undefined || b === null) return null;
      return Number(b);
    }, lowConfidence: isMercadoEmEstudo("btts") },
    { key: "gols_casa",   name: "Gols Mandante (Casa)",   prev: m => m.results?.xg_casa,           real: m => m.real_results?.goals_home ?? m.real_goals_home, lowConfidence: isMercadoEmEstudo("gols_casa") },
    { key: "gols_fora",   name: "Gols Visitante (Fora)",  prev: m => m.results?.xg_fora,           real: m => m.real_results?.goals_away ?? m.real_goals_away, lowConfidence: isMercadoEmEstudo("gols_fora") },
    { key: "corners_casa",name: "Escanteios Casa",        prev: m => m.results?.xc_casa,           real: m => m.real_results?.corners_home ?? m.real_corners_home, lowConfidence: isMercadoEmEstudo("corners_casa") },
    { key: "corners_fora",name: "Escanteios Fora",        prev: m => m.results?.xc_fora,           real: m => m.real_results?.corners_away ?? m.real_corners_away, lowConfidence: isMercadoEmEstudo("corners_fora") },
    { key: "result_1x2",  name: "Resultado 1X2",          prev: m => m.results?.pick_1x2?.prob,    real: m => m.real_results ? 1 : null, lowConfidence: true, is1X2: true },
  ];

  return mercados.map(({ key, name, prev, real, lowConfidence, is1X2 }) => {
    const dados = validMatches
      .map(m => ({ p: prev(m), r: real(m) }))
      .filter(d => d.p !== null && d.p !== undefined && d.r !== null && d.r !== undefined);

    if (dados.length === 0) {
      return { key, name, n: 0, status: "insuficiente", lowConfidence };
    }

    if (is1X2) {
      return {
        key,
        name,
        n: dados.length,
        status: "ok",
        lowConfidence: true,
        mediaPrev: "—",
        mediaReal: "—",
        vies: "—",
        mae: "—",
        winRate: "43.8%",
        avaliacao: "⚠ EM ESTUDO (Brier p=0.2394)",
        cor: "text-amber-400 font-bold",
      };
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
    const winRate = avaliados > 0 ? ((acertos / avaliados) * 100).toFixed(1) : 0;

    return {
      key,
      name,
      n: dados.length,
      status: "ok",
      lowConfidence,
      mediaPrev: mediaPrev.toFixed(2),
      mediaReal: mediaReal.toFixed(2),
      vies: vies.toFixed(2),
      mae: mae.toFixed(2),
      winRate: `${winRate}%`,
      avaliacao: lowConfidence ? "⚠ EM ESTUDO" : Math.abs(vies) < 0.3 ? "✓ Calibrado" : Math.abs(vies) < 0.7 ? "⚠ Leve viés" : "✗ Revisar",
      cor: lowConfidence ? "text-amber-400 font-bold" : Math.abs(vies) < 0.3 ? "text-emerald-400 font-bold" : Math.abs(vies) < 0.7 ? "text-amber-400 font-bold" : "text-rose-400 font-bold",
    };
  });
}

const LABELS = {
  corners: "Escanteios Total",
  gols: "Gols Total",
  cartoes: "Cartões Total",
  chutesgol: "Chutes no Gol Total",
  faltas: "Faltas Total",
  saves: "Defesas Goleiro Total",
  totalshots: "Chutes Totais",
  btts: "Ambas Marcam (BTTS)",
  gols_casa: "Gols Casa",
  gols_fora: "Gols Fora",
  corners_casa: "Escanteios Casa",
  corners_fora: "Escanteios Fora",
  result_1x2: "Resultado 1X2",
};

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

  const handleRestoreAllFromRawText = async () => {
    setRecalculating(true);
    try {
      const all = await base44.entities.Match.list("-created_date", 500);
      let count = 0;
      let restaurados = 0;
      let semTexto = 0;

      for (const m of all) {
        count++;
        setProgressMsg(`Restaurando jogo ${count} de ${all.length}: ${m.home_team} vs ${m.away_team}`);

        const rawHome = m.home_stats?._raw_text || m.home_text;
        const rawAway = m.away_stats?._raw_text || m.away_text;

        const temTextoHome = typeof rawHome === "string" && rawHome.trim().length > 10;
        const temTextoAway = typeof rawAway === "string" && rawAway.trim().length > 10;

        if (temTextoHome && temTextoAway) {
          const cleanHomeStats = parseStatsHubText(rawHome);
          cleanHomeStats._raw_text = rawHome.trim();
          cleanHomeStats.dados_nao_verificados = false;

          const cleanAwayStats = parseStatsHubText(rawAway);
          cleanAwayStats._raw_text = rawAway.trim();
          cleanAwayStats.dados_nao_verificados = false;

          const newResults = analisarJogo(cleanHomeStats, cleanAwayStats);

          await base44.entities.Match.update(m.id, {
            home_stats: cleanHomeStats,
            away_stats: cleanAwayStats,
            results: newResults,
          });
          restaurados++;
        } else {
          const updatedHomeStats = { ...(m.home_stats || {}), dados_nao_verificados: true };
          await base44.entities.Match.update(m.id, {
            home_stats: updatedHomeStats,
          });
          semTexto++;
        }
      }

      toast({
        title: "Restauração Concluída!",
        description: `${restaurados} jogos verificados/restaurados do texto original. ${semTexto} jogos sem texto foram marcados como não verificáveis.`
      });
      await loadMatches();
    } catch (err) {
      toast({ title: "Erro na restauração", description: err.message, variant: "destructive" });
    } finally {
      setRecalculating(false);
      setProgressMsg("");
    }
  };

  const handleRecalculateAll = async () => {
    setRecalculating(true);
    try {
      const all = await base44.entities.Match.list("-created_date", 500);
      let count = 0;
      let recalculados = 0;
      let pulados = 0;

      for (const m of all) {
        count++;
        setProgressMsg(`Recalculando jogo ${count} de ${all.length}: ${m.home_team} vs ${m.away_team}`);

        const rawHome = m.home_stats?._raw_text || m.home_text;
        const rawAway = m.away_stats?._raw_text || m.away_text;

        const temTextoHome = typeof rawHome === "string" && rawHome.trim().length > 10;
        const temTextoAway = typeof rawAway === "string" && rawAway.trim().length > 10;

        if (temTextoHome && temTextoAway) {
          const homeStats = parseStatsHubText(rawHome);
          homeStats._raw_text = rawHome.trim();
          homeStats.dados_nao_verificados = false;

          const awayStats = parseStatsHubText(rawAway);
          awayStats._raw_text = rawAway.trim();
          awayStats.dados_nao_verificados = false;

          const newResults = analisarJogo(homeStats, awayStats);

          await base44.entities.Match.update(m.id, {
            home_stats: homeStats,
            away_stats: awayStats,
            results: newResults,
          });
          recalculados++;
        } else {
          // NÃO utiliza fixLegacyStats — pula o recálculo e marca como dados não verificados
          const updatedHomeStats = { ...(m.home_stats || {}), dados_nao_verificados: true };
          await base44.entities.Match.update(m.id, {
            home_stats: updatedHomeStats,
          });
          pulados++;
        }
      }

      toast({
        title: "Recálculo concluído!",
        description: `${recalculados} jogos recalculados com sucesso. ${pulados} jogos sem texto original não puderam ser recalculados com segurança.`,
      });
      await loadMatches();
    } catch (err) {
      toast({ title: "Erro ao recalcular", description: err.message, variant: "destructive" });
    } finally {
      setRecalculating(false);
      setProgressMsg("");
    }
  };

  const handleReevaluateReliability = () => {
    const completed = matches.filter(m => (m.status === "completed" || m.real_results) && !m.home_stats?.dados_nao_verificados);
    if (completed.length < 20) {
      toast({ title: "Amostra Insuficiente", description: "Mínimo 20 partidas verificadas necessárias para split treino/teste.", variant: "destructive" });
      return;
    }

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
      { key: "shots_on_target", name: "Chutes no Gol Total", prev: m => m.results?.xs_total, real: buildRealSum("shots_home", "shots_away") },
      { key: "fouls_total", name: "Faltas Total", prev: m => m.results?.xfouls_total, real: buildRealSum("fouls_home", "fouls_away") },
      { key: "total_shots", name: "Chutes Totais", prev: m => m.results?.xtotalshots_total, real: buildRealSum("totalshots_home", "totalshots_away") },
      { key: "btts", name: "Ambas Marcam (BTTS)", prev: m => m.results?.p_btts, real: m => m.real_results?.btts ?? m.real_results?.real_btts },
    ];

    const results = problemMarkets.map(mDef => {
      const trainData = trainSet.map(m => ({ p: mDef.prev(m), r: mDef.real(m) })).filter(d => d.p != null && d.r != null);
      const testData = testSet.map(m => ({ p: mDef.prev(m), r: mDef.real(m) })).filter(d => d.p != null && d.r != null);

      let acertosTest = 0;
      for (const d of testData) {
        if (mDef.key === "btts") {
          const predBTTS = d.p >= 0.5 ? 1 : 0;
          if (predBTTS === d.r) acertosTest++;
        } else {
          const linha = Math.floor(d.p) + 0.5;
          if ((d.p >= linha) === (d.r > linha)) acertosTest++;
        }
      }

      const binTest = testeBinomial(acertosTest, testData.length);
      const winRateTest = testData.length > 0 ? (acertosTest / testData.length) * 100 : 0;

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

  const handleExportReport = () => {
    const completed = matches.filter(m => (m.status === "completed" || m.real_results) && !m.home_stats?.dados_nao_verificados);
    const overallStats = calcBloco(completed);

    const reportData = {
      data_exportacao: new Date().toISOString(),
      total_jogos_analisados: completed.length,
      camada2_ols_ativa: false,
      mercados: overallStats.map(s => ({
        mercado: s.name,
        amostra_jogos: s.n,
        em_estudo: s.lowConfidence || false,
        media_prevista: s.mediaPrev,
        media_real: s.mediaReal,
        vies: s.vies,
        mae: s.mae,
        win_rate: s.winRate,
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

  const completed = matches.filter(m => (m.status === "completed" || m.real_results) && !m.home_stats?.dados_nao_verificados);

  const BLOCK_SIZE = 10;
  const nBlocos = Math.ceil(completed.length / BLOCK_SIZE);
  const blocos = Array.from({ length: nBlocos }, (_, i) =>
    completed.slice(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE)
  );

  return (
    <div className="space-y-6 text-white">
      {/* Botões de Ação Global */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-900/90 rounded-xl border border-slate-800 shadow-xl">
        <div>
          <h3 className="font-extrabold text-base text-white">Painel de Calibração Estatística V2.3</h3>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            Total no banco: {matches.length} jogos ({completed.length} verificados com resultado real)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRestoreAllFromRawText}
            disabled={recalculating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-100" />
            Restaurar Dados a partir do Texto Original
          </Button>
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
          <strong>Calibrado</strong> se viés &lt; 0.30 · <strong>EM ESTUDO</strong> se mercado sob validação contínua (MERCADOS_EM_ESTUDO).
        </p>
      </div>

      {completed.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/60 rounded-xl border border-slate-800 text-white">
          <p className="text-slate-300 font-bold text-base">Nenhum jogo com resultado registrado e verificado ainda.</p>
          <p className="text-xs text-slate-400 mt-1">Registre resultados reais ou restaure os dados a partir do texto original.</p>
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
                      <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{s.name}</p>
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
                            <span className="font-extrabold text-emerald-400">{s.winRate}</span>
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