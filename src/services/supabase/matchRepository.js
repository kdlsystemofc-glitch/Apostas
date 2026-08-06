import { supabase } from "./client";

export const MatchRepository = {
  /**
   * Carrega todas as partidas salvas do Supabase ordenadas pela data de criação
   */
  async getAllMatches() {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("created_date", { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Busca uma partida específica pelo seu UUID
   */
  async getMatchById(id) {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Cria uma nova análise de partida no banco de dados
   */
  async createMatch(matchPayload) {
    const { data, error } = await supabase
      .from("matches")
      .insert([matchPayload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Salva os resultados reais do pós-jogo para calibração
   */
  async updateRealResults(id, realResults) {
    const { data, error } = await supabase
      .from("matches")
      .update({
        real_results: realResults,
        status: "completed",
        updated_date: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Remove uma partida do banco
   */
  async deleteMatch(id) {
    const { error } = await supabase
      .from("matches")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};
