import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Plus, History, CalendarDays, TrendingUp, Download, Trophy } from "lucide-react";
import StatsInput from "@/components/stats/StatsInput";
import MatchResults from "@/components/stats/MatchResults";
import MatchHistory from "@/components/stats/MatchHistory";
import DailyOverview from "@/components/stats/DailyOverview";
import CalibrationView from "@/components/stats/CalibrationView";

export default function Home() {
  const [lastMatch, setLastMatch] = useState(null);
  const [lastLeagueProfile, setLastLeagueProfile] = useState(null);
  const [tab, setTab] = useState("new");
  const navigate = useNavigate();

  const handleAnalysisComplete = (match, leagueProfile) => {
    setLastMatch(match);
    setLastLeagueProfile(leagueProfile);
    setTab("results");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Sports Predictor</h1>
              <p className="text-xs text-muted-foreground">Análise de mercados esportivos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/league-profiles")} className="gap-1.5">
              <Trophy className="w-4 h-4" /> Perfis de Liga
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/export")} className="gap-1.5">
              <Download className="w-4 h-4" /> Exportar Dados
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="new" className="gap-1.5">
              <Plus className="w-4 h-4" /> Nova Análise
            </TabsTrigger>
            {lastMatch && (
              <TabsTrigger value="results" className="gap-1.5">
                <BarChart3 className="w-4 h-4" /> Resultado
              </TabsTrigger>
            )}
            <TabsTrigger value="daily" className="gap-1.5">
              <CalendarDays className="w-4 h-4" /> Apostas do Dia
            </TabsTrigger>
            <TabsTrigger value="calibration" className="gap-1.5">
              <TrendingUp className="w-4 h-4" /> Calibração
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <History className="w-4 h-4" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Nova Análise</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Cole as estatísticas do StatsHub para cada time. Copie a tabela inteira (Stat Type, Média Total, Média do Time, Média Cedida, e todos os jogos).
                </p>
              </div>
              <StatsInput onAnalysisComplete={handleAnalysisComplete} />
            </div>
          </TabsContent>

          <TabsContent value="results">
            {lastMatch && <MatchResults match={lastMatch} leagueProfile={lastLeagueProfile} />}
          </TabsContent>

          <TabsContent value="calibration">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Calibração do Modelo</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Análise a cada 10 jogos — compara previsões com resultados reais para identificar viés.
                </p>
              </div>
              <CalibrationView />
            </div>
          </TabsContent>

          <TabsContent value="daily">
            <DailyOverview />
          </TabsContent>

          <TabsContent value="history">
            <MatchHistory onSelectMatch={(match) => navigate(`/match/${match.id}`)} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}