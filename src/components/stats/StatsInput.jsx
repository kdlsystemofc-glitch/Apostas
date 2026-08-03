import React, { useState, useEffect } from "react";
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
  const [leagueProfileId, setLeagueProfileId] = useState("");
  const [leagueProfiles, setLeagueProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.LeagueProfile.list("-created_date", 50)
      .then(setLeagueProfiles);
  }, []);
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

      const results = analisarJogo(homeStats, awayStats);

      const match = await base44.entities.Match.create({
        home_team: homeTeam.trim(),
        away_team: awayTeam.trim(),
        date: matchDate,
        league_profile_id: leagueProfileId || null,
        home_stats: homeStats,
        away_stats: awayStats,
        results,
        status: "pending",
      });

      const selectedProfile = leagueProfiles.find(lp => lp.id === leagueProfileId) || null;
      toast({ title: "Análise concluída!", description: `${homeTeam} vs ${awayTeam}` });
      onAnalysisComplete?.(match, selectedProfile);

      setHomeTeam("");
      setAwayTeam("");
      setHomeText("");
      setAwayText("");
      setLeagueProfileId("");
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const placeholderTextCasa = "Cole aqui as estatísticas do time da casa.\n\nFormatos aceitos:\n• Direto do StatsHub: copie a tabela inteira do site\n• Via Excel: copie do Excel após colar do StatsHub\n\nEstatísticas necessárias: Goals, Corners, Cards, Shots On Target, Total Shots, Fouls, etc.";
  const placeholderTextFora = "Cole aqui as estatísticas do time de fora.\n\nFormatos aceitos:\n• Direto do StatsHub: copie a tabela inteira do site\n• Via Excel: copie do Excel após colar do StatsHub\n\nEstatísticas necessárias: Goals, Corners, Cards, Shots On Target, Total Shots, Fouls, etc.";

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Campeonato <span className="text-slate-400">(opcional)</span>
        </Label>
        <select
          value={leagueProfileId}
          onChange={e => setLeagueProfileId(e.target.value)}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">— Sem perfil de liga —</option>
          {leagueProfiles.map(lp => (
            <option key={lp.id} value={lp.id}>
              {lp.name} {lp.season ? `(${lp.season})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">🏠 Time da Casa (mandante)</Label>
          <Input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Ex: Argentina" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">✈️ Time de Fora (visitante)</Label>
          <Input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Ex: Austria" className="mt-1.5" />
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data do Jogo</Label>
          <Input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="mt-1.5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardPaste className="w-3.5 h-3.5" />
            Estatísticas — {homeTeam || "Casa"}
          </Label>
          <Textarea
            value={homeText}
            onChange={e => setHomeText(e.target.value)}
            placeholder={placeholderTextCasa}
            className="mt-1.5 h-48 font-mono text-xs"
          />
          <div className={`mt-1.5 text-xs font-medium ${
            homeStatsCount >= 10 ? "text-emerald-600" :
            homeStatsCount >= 5 ? "text-amber-600" : "text-red-500"
          }`}>
            {homeText.length > 5 ? `${homeStatsCount} estatísticas detectadas` : ""}
            {homeStatsCount >= 10 && " ✓"}
            {homeStatsCount > 0 && homeStatsCount < 5 && " — formato não reconhecido"}
          </div>
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <ClipboardPaste className="w-3.5 h-3.5" />
            Estatísticas — {awayTeam || "Fora"}
          </Label>
          <Textarea
            value={awayText}
            onChange={e => setAwayText(e.target.value)}
            placeholder={placeholderTextFora}
            className="mt-1.5 h-48 font-mono text-xs"
          />
          <div className={`mt-1.5 text-xs font-medium ${
            awayStatsCount >= 10 ? "text-emerald-600" :
            awayStatsCount >= 5 ? "text-amber-600" : "text-red-500"
          }`}>
            {awayText.length > 5 ? `${awayStatsCount} estatísticas detectadas` : ""}
            {awayStatsCount >= 10 && " ✓"}
            {awayStatsCount > 0 && awayStatsCount < 5 && " — formato não reconhecido"}
          </div>
        </div>
      </div>

      {statsInsuficientes && (homeText.length > 10 || awayText.length > 10) && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-xs text-red-700 font-medium">
            ⚠ Formato não reconhecido — {homeStatsCount} stats (casa) / {awayStatsCount} stats (fora)
          </p>
          <p className="text-xs text-red-600 mt-1">
            Dica: copie a tabela inteira do StatsHub (todas as linhas de Goals até Yellow Cards)
          </p>
        </div>
      )}

      <Button onClick={handleAnalyze} disabled={statsInsuficientes || loading || !homeTeam.trim() || !awayTeam.trim()} className="w-full h-12 text-base font-semibold">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Zap className="w-5 h-5 mr-2" />}
        {loading ? "Analisando..." : "Analisar Jogo"}
      </Button>
    </div>
  );
}