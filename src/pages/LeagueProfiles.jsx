import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Upload, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Mapeamento do CSV do FootyStats para os campos do LeagueProfile
function parseCsvFootyStats(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) throw new Error("CSV inválido — esperado cabeçalho + 1 linha de dados");
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ""));
  const values  = lines[1].split(",").map(v => v.trim().replace(/"/g, ""));
  const row = {};
  headers.forEach((h, i) => { row[h] = values[i]; });

  const n = k => row[k] ? parseFloat(row[k]) : null;
  const s = k => row[k] || null;

  return {
    name:           s("name") || "Liga sem nome",
    season:         s("season"),
    source:         "FootyStats",
    matches_sample: n("matches_completed"),
    avg_goals:        n("average_goals_per_match"),
    avg_goals_home:   n("average_scored_home_team"),
    avg_goals_away:   n("average_scored_away_team"),
    avg_corners:      n("average_corners_per_match"),
    avg_corners_home: n("average_corners_per_match_home_team"),
    avg_corners_away: n("average_corners_per_match_away_team"),
    avg_cards:        n("average_cards_per_match"),
    avg_cards_home:   n("average_cards_per_match_home_team"),
    avg_cards_away:   n("average_cards_per_match_away_team"),
    avg_xg:           n("xg_avg_per_match"),
    btts_pct:         n("btts_percentage"),
    over_05_goals_pct: n("over_05_percentage"),
    over_15_goals_pct: n("over_15_percentage"),
    over_25_goals_pct: n("over_25_percentage"),
    over_35_goals_pct: n("over_35_percentage"),
    over_45_goals_pct: n("over_45_percentage"),
    over_55_goals_pct: n("over_55_percentage"),
    over_65_corners_pct:  n("over_65_corners_percentage"),
    over_75_corners_pct:  n("over_75_corners_percentage"),
    over_85_corners_pct:  n("over_85_corners_percentage"),
    over_95_corners_pct:  n("over_95_corners_percentage"),
    over_105_corners_pct: n("over_105_corners_percentage"),
    over_115_corners_pct: n("over_115_corners_percentage"),
    over_125_corners_pct: n("over_125_corners_percentage"),
    over_135_corners_pct: n("over_135_corners_percentage"),
    over_05_cards_pct: n("over_05_cards_percentage"),
    over_15_cards_pct: n("over_15_cards_percentage"),
    over_25_cards_pct: n("over_25_cards_percentage"),
    over_35_cards_pct: n("over_35_cards_percentage"),
    over_45_cards_pct: n("over_45_cards_percentage"),
    over_55_cards_pct: n("over_55_cards_percentage"),
  };
}

export default function LeagueProfiles() {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(null);
  const fileRef = useRef();

  const load = () =>
    base44.entities.LeagueProfile.list("-created_date", 50)
      .then(setProfiles).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setSuccess(null);
    try {
      const text = await file.text();
      const parsed = parseCsvFootyStats(text);
      await base44.entities.LeagueProfile.create(parsed);
      setSuccess(parsed.name);
      await load();
    } catch (err) {
      alert("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover este perfil de liga?")) return;
    await base44.entities.LeagueProfile.delete(id);
    await load();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-lg font-bold tracking-tight">Perfis de Liga</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Importe o CSV do FootyStats para calibrar as previsões com o
            padrão histórico real de cada campeonato.
          </p>
        </div>

        {/* Import */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-sm">Importar CSV do FootyStats</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Em footystats.org, acesse o campeonato → clique em "Download Stats"
              → salve o CSV. O arquivo tem uma linha com todas as médias da liga.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
              id="csv-upload"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="gap-2"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                : <><Upload className="w-4 h-4" /> Escolher CSV</>}
            </Button>
            {success && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle className="w-4 h-4" />
                "{success}" importado!
              </span>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 border p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-slate-700">Como baixar no FootyStats:</p>
            <p>1. Acesse <strong>footystats.org</strong> e busque o campeonato</p>
            <p>2. Na página do campeonato, clique em <strong>"Download Stats"</strong> (botão no topo)</p>
            <p>3. Selecione <strong>"League Stats CSV"</strong></p>
            <p>4. Importe o arquivo aqui — o mapeamento é automático</p>
          </div>
        </div>

        {/* Lista de perfis */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12 rounded-xl border bg-card">
            <p className="text-muted-foreground text-sm">Nenhum perfil importado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profiles.map(p => (
              <div key={p.id} className="rounded-xl border bg-card overflow-hidden">
                <div className="px-5 py-3 bg-slate-900 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{p.name}</h3>
                    <p className="text-xs text-slate-400">
                      {p.season} · {p.source} · {p.matches_sample} jogos
                    </p>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleDelete(p.id)}
                    className="text-slate-400 hover:text-red-400 h-7 px-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["Gols/jogo",    p.avg_goals?.toFixed(2)],
                    ["Corners/jogo", p.avg_corners?.toFixed(2)],
                    ["Cartões/jogo", p.avg_cards?.toFixed(2)],
                    ["BTTS %",       p.btts_pct ? p.btts_pct + "%" : null],
                    ["xG/jogo",      p.avg_xg?.toFixed(2)],
                    ["Gols casa",    p.avg_goals_home?.toFixed(2)],
                    ["Corners casa", p.avg_corners_home?.toFixed(2)],
                    ["Corners fora", p.avg_corners_away?.toFixed(2)],
                  ].map(([label, val]) => val ? (
                    <div key={label} className="rounded-lg bg-slate-50 p-3">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-lg font-bold mt-0.5">{val}</p>
                    </div>
                  ) : null)}
                </div>
                {/* Over histórico */}
                <div className="px-4 pb-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Over Gols</p>
                    {[["0.5", p.over_05_goals_pct],["1.5", p.over_15_goals_pct],
                      ["2.5", p.over_25_goals_pct],["3.5", p.over_35_goals_pct]].map(([l, v]) =>
                      v != null ? (
                        <div key={l} className="flex justify-between text-xs">
                          <span className="text-blue-600">Over {l}</span>
                          <span className="font-bold text-blue-800">{v}%</span>
                        </div>
                      ) : null
                    )}
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs font-medium text-emerald-700 mb-1">Over Corners</p>
                    {[["7.5", p.over_75_corners_pct],["8.5", p.over_85_corners_pct],
                      ["9.5", p.over_95_corners_pct],["10.5", p.over_105_corners_pct]].map(([l, v]) =>
                      v != null ? (
                        <div key={l} className="flex justify-between text-xs">
                          <span className="text-emerald-600">Over {l}</span>
                          <span className="font-bold text-emerald-800">{v}%</span>
                        </div>
                      ) : null
                    )}
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <p className="text-xs font-medium text-amber-700 mb-1">Over Cartões</p>
                    {[["1.5", p.over_15_cards_pct],["2.5", p.over_25_cards_pct],
                      ["3.5", p.over_35_cards_pct],["4.5", p.over_45_cards_pct]].map(([l, v]) =>
                      v != null ? (
                        <div key={l} className="flex justify-between text-xs">
                          <span className="text-amber-600">Over {l}</span>
                          <span className="font-bold text-amber-800">{v}%</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}