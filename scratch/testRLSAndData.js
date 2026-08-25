import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://juajunyfksnagqiatlvk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YWp1bnlma3NuYWdxaWF0bHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODk0OTAsImV4cCI6MjEwMTM2NTQ5MH0.Pwrb2xOzhlqmHoSbgd1pyeGtqoMHtRWNPk8gAbVcD2A";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRLSAndData() {
  console.log("=== VERIFICAÇÃO DE DADOS E CONEXÃO SUPABASE ===");
  console.log("URL de Produção:", supabaseUrl);

  // 1. Teste de Leitura da Tabela matches
  const { data: matches, error: errSelect } = await supabase
    .from("matches")
    .select("id, home_team, away_team, date, status, created_date")
    .order("created_date", { ascending: false })
    .limit(10);

  if (errSelect) {
    console.error("❌ Erro no SELECT (Possível problema de RLS ou Permissões):", errSelect);
  } else {
    console.log(`✅ SELECT bem-sucedido! ${matches.length} partidas retornadas no topo da lista.`);
    matches.forEach(m => {
      console.log(`   - [${m.created_date}] ${m.home_team} vs ${m.away_team} (ID: ${m.id})`);
    });
  }

  // 2. Teste de Leitura da Tabela league_profiles
  const { data: profiles, error: errProfiles } = await supabase
    .from("league_profiles")
    .select("id, league_name, created_date")
    .limit(5);

  if (errProfiles) {
    console.error("❌ Erro em league_profiles:", errProfiles);
  } else {
    console.log(`✅ league_profiles ok! Total: ${profiles.length}`);
  }
}

testRLSAndData();
