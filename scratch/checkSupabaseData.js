import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://juajunyfksnagqiatlvk.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1YWp1bnlma3NuYWdxaWF0bHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODk0OTAsImV4cCI6MjEwMTM2NTQ5MH0.Pwrb2xOzhlqmHoSbgd1pyeGtqoMHtRWNPk8gAbVcD2A";

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Conectando ao Supabase:", supabaseUrl);

  const { data: matches, error, count } = await supabase
    .from("matches")
    .select("*", { count: "exact" })
    .order("created_date", { ascending: false });

  if (error) {
    console.error("Erro ao buscar matches:", error);
    return;
  }

  console.log(`\nTotal de partidas encontradas no Supabase ('matches'): ${count || matches.length}`);
  if (matches.length > 0) {
    console.log("Últimas 5 partidas cadastradas:");
    matches.slice(0, 5).forEach((m, i) => {
      console.log(`  ${i+1}. ID: ${m.id} | ${m.home_team} vs ${m.away_team} | Date: ${m.date} | Status: ${m.status} | RealResults: ${m.real_results ? "SIM" : "NÃO"} | Criado: ${m.created_date}`);
    });
  } else {
    console.log("⚠️ Nenhuma partida encontrada na tabela 'matches'.");
  }
}

check();
