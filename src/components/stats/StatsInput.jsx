import React, { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { parseStatsHubText, analisarJogo } from "@/lib/predictionEngine";
import { base44 } from "@/api/base44Client";
import { Loader2, ClipboardPaste, Zap } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function StatsInput({ onAnalysisComplete }) {
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [homeText, setHomeText] = useState("");
  const [awayText, setAwayText] = useState("");
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const homeStatsCount = Object.keys(parseStatsHubText(homeText)).length;
  const awayStatsCount = Object.keys(parseStatsHubText(awayText)).length;
  const statsInsuficientes = homeStatsCount < 5 || awayStatsCount < 5;

  const handleAnalyze = async () => {
    if (!homeTeam.trim() || !awayTeam.trim()) {
      toast({ title: "Erro", description: "Preencha os nomes dos times.", variant: "destructive" });
      return;
    }
    if (!homeText.trim() || !awayText.trim()) {
      toast({ title: "Erro", description: "Cole as estatísticas dos dois times.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const homeStats = parseStatsHubText(homeText);
      const awayStats = parseStatsHubText(awayText);

      const statsFound = Object.keys(homeStats).length;
      if (statsFound < 3) {
        toast({ title: "Erro", description: `Poucas estatísticas encontradas para o time da casa (${statsFound}). Verifique o formato colado.`, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Análise 100% Autônoma pelo Motor Estatístico sem interferência externa
      const results = analisarJogo(homeStats, awayStats);

      const match = await base44.entities.Match.create({
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        date: matchDate,
        home_stats: homeStats,
        away_stats: awayStats,
        results,
        status: "pending",
      });

      toast({ title: "Análise concluída!", description: `${homeTeam} vs ${awayTeam}` });
      onAnalysisComplete?.(match);

      setHomeTeam("");
      setAwayTeam("");
      setHomeText("");
      setAwayText("");
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const placeholderTextCasa = "Cole aqui as estatísticas do time da casa.\n\nFormatos aceitos:\n• Direto do StatsHub: copie a tabela inteira do site\n• Via Excel: copie do Excel após colar do StatsHub\n\nEstatísticas necessárias: Goals, Corners, Cards, Shots On Target, Total Shots, Fouls, etc.";
  const placeholderTextFora = "Cole aqui as estatísticas do time de fora.\n\nFormatos aceitos:\n• Direto do StatsHub: copie a tabela inteira do site\n• Via Excel: copie do Excel após colar do StatsHub\n\nEstatísticas necessárias: Goals, Corners, Cards, Shots On Target, Total Shots, Fouls, etc.";

  return (
    <div className="space-y-6 bg-slate-900/90 backdrop-blur-md p-6 rounded-xl border border-slate-800 shadow-xl text-white">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">🏠 Time da Casa (mandante)</Label>
          <Input
            value={homeTeam}
            onChange={e => setHomeTeam(e.target.value)}
            placeholder="Ex: Argentina"
            className="mt-1.5 bg-slate-950 border-slate-700 text-white font-bold placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">✈️ Time de Fora (visitante)</Label>
          <Input
            value={awayTeam}
            onChange={e => setAwayTeam(e.target.value)}
            placeholder="Ex: Austria"
            className="mt-1.5 bg-slate-950 border-slate-700 text-white font-bold placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Data do Jogo</Label>
          <Input
            type="date"
            value={matchDate}
            onChange={e => setMatchDate(e.target.value)}
            className="mt-1.5 bg-slate-950 border-slate-700 text-white font-bold focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            Estatísticas — {homeTeam || "Casa"}
          </Label>
          <Textarea
            value={homeText}
            onChange={e => setHomeText(e.target.value)}
            placeholder={placeholderTextCasa}
            className="mt-1.5 h-48 font-mono text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500"
          />
          <div className={`mt-1.5 text-xs font-bold tabular-nums ${
            homeStatsCount >= 10 ? "text-emerald-400" :
            homeStatsCount >= 5 ? "text-amber-400" : "text-rose-400"
          }`}>
            {homeText.length > 5 ? `${homeStatsCount} estatísticas detectadas` : ""}
            {homeStatsCount >= 10 && " ✓"}
            {homeStatsCount > 0 && homeStatsCount < 5 && " — formato não reconhecido"}
          </div>
        </div>
        <div>
          <Label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
            Estatísticas — {awayTeam || "Fora"}
          </Label>
          <Textarea
            value={awayText}
            onChange={e => setAwayText(e.target.value)}
            placeholder={placeholderTextFora}
            className="mt-1.5 h-48 font-mono text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500"
          />
          <div className={`mt-1.5 text-xs font-bold tabular-nums ${
            awayStatsCount >= 10 ? "text-emerald-400" :
            awayStatsCount >= 5 ? "text-amber-400" : "text-rose-400"
          }`}>
            {awayText.length > 5 ? `${awayStatsCount} estatísticas detectadas` : ""}
            {awayStatsCount >= 10 && " ✓"}
            {awayStatsCount > 0 && awayStatsCount < 5 && " — formato não reconhecido"}
          </div>
        </div>
      </div>

      {statsInsuficientes && (homeText.length > 10 || awayText.length > 10) && (
        <div className="rounded-lg bg-rose-950/80 border border-rose-800 p-3.5">
          <p className="text-xs text-rose-300 font-bold">
            ⚠ Formato não reconhecido — {homeStatsCount} stats (casa) / {awayStatsCount} stats (fora)
          </p>
          <p className="text-xs text-rose-200 mt-1">
            Dica: copie a tabela inteira do StatsHub (todas as linhas de Goals até Yellow Cards)
          </p>
        </div>
      )}

      <Button
        onClick={handleAnalyze}
        disabled={statsInsuficientes || loading || !homeTeam.trim() || !awayTeam.trim()}
        className="w-full h-12 text-base font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-600/30 transition-all"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
        {loading ? "Analisando..." : "Analisar Jogo"}
      </Button>
    </div>
  );
}