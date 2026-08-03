import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, ArrowLeft, Edit3, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import MatchResults from "@/components/stats/MatchResults";
import MatchResultBlock from "@/components/stats/MatchResultBlock";
import CornerDetails from "@/components/stats/CornerDetails";
import BestBetsByMarket from "@/components/stats/BestBetsByMarket";

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [realResults, setRealResults] = useState({});
  const [leagueProfile, setLeagueProfile] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    base44.entities.Match.get(id).then((m) => {
      setMatch(m);
      setRealResults(m.real_results || {});
      if (m.league_profile_id) {
        base44.entities.LeagueProfile.get(m.league_profile_id)
          .then(setLeagueProfile)
          .catch(() => setLeagueProfile(null));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const handleSaveReal = async () => {
    try {
      const updated = { ...realResults };
      // BTTS calculado automaticamente pelos gols
      const gh = updated.goals_home;
      const ga = updated.goals_away;
      if (gh !== "" && gh !== undefined && ga !== "" && ga !== undefined) {
        updated.btts = (Number(gh) > 0 && Number(ga) > 0) ? 1 : 0;
      }
      setRealResults(updated);

      const hasAnyData = Object.values(updated).some(v => v !== "" && v !== undefined && v !== null);
      await base44.entities.Match.update(id, {
        real_results: updated,
        status: hasAnyData ? "completed" : "pending",
      });
      setMatch(prev => ({ ...prev, real_results: updated, status: hasAnyData ? "completed" : "pending" }));
      setEditing(false);
      toast({ title: "Resultados salvos!" });
    } catch (err) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Jogo não encontrado.</p>
      </div>
    );
  }

  const realFields = [
    { key: "corners_home", label: "Corners Casa" },
    { key: "corners_away", label: "Corners Fora" },
    { key: "goals_home", label: "Gols Casa" },
    { key: "goals_away", label: "Gols Fora" },
    { key: "shots_home", label: "Chutes Casa" },
    { key: "shots_away", label: "Chutes Fora" },
    { key: "cards_home", label: "Cartões Casa" },
    { key: "cards_away", label: "Cartões Fora" },
    { key: "fouls_home",  label: "Faltas Casa" },
    { key: "fouls_away",  label: "Faltas Fora" },
    { key: "saves_home",  label: "Defesas Goleiro Casa" },
    { key: "saves_away",  label: "Defesas Goleiro Fora" },
    { key: "totalshots_home", label: "Chutes Totais Casa" },
    { key: "totalshots_away", label: "Chutes Totais Fora" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-semibold">{match.home_team} vs {match.away_team}</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-8">
        <MatchResultBlock match={match} />
        <MatchResults match={match} leagueProfile={leagueProfile} />

        <BestBetsByMarket match={match} leagueProfile={leagueProfile} />

        {match.results?.dc && (
          <CornerDetails match={match} />
        )}

        {/* Real Results Section */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-amber-900">Resultados Reais</h3>
              <p className="text-xs text-amber-700 mt-0.5">Preencha após o jogo para calibrar o modelo</p>
            </div>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Editar
              </Button>
            ) : (
              <Button size="sm" onClick={handleSaveReal} className="gap-1.5">
                <Save className="w-3.5 h-3.5" /> Salvar
              </Button>
            )}
          </div>

          <div className="p-5">
            {editing ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {realFields.map(({ key, label }) => (
                  <div key={key}>
                    <Label className="text-xs">{label}</Label>
                    <Input
                      type="number"
                      value={realResults[key] ?? ""}
                      onChange={e => setRealResults(prev => ({ ...prev, [key]: e.target.value ? Number(e.target.value) : "" }))}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {realFields.map(({ key, label }) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-lg font-bold mt-0.5">
                      {realResults[key] !== undefined && realResults[key] !== "" ? realResults[key] : "—"}
                    </p>
                  </div>
                ))}
                <div className="rounded-lg bg-slate-100 p-3 border border-slate-200">
                  <p className="text-xs text-muted-foreground">BTTS (auto)</p>
                  <p className="text-lg font-bold mt-0.5">
                    {realResults.btts === 1 ? "✓ Sim" : realResults.btts === 0 ? "✗ Não" : "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}