import { supabase } from "@/lib/supabaseClient";

function createEntityClient(tableName) {
  return {
    async create(data) {
      const { data: row, error } = await supabase
        .from(tableName)
        .insert({ ...data, created_date: new Date().toISOString() })
        .select()
        .single();
      if (error) throw new Error(`Erro ao criar: ${error.message}`);
      return row;
    },

    async list(sort = "-created_date", limit = 500) {
      const desc = sort.startsWith("-");
      const col = sort.replace("-", "");
      const { data: rows, error } = await supabase
        .from(tableName)
        .select("*")
        .order(col, { ascending: !desc })
        .limit(limit);
      if (error) throw new Error(`Erro ao listar: ${error.message}`);
      return rows || [];
    },

    async get(id) {
      const { data: row, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw new Error(`Erro ao buscar: ${error.message}`);
      return row;
    },

    async update(id, data) {
      const { data: row, error } = await supabase
        .from(tableName)
        .update({ ...data, updated_date: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(`Erro ao atualizar: ${error.message}`);
      return row;
    },

    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);
      if (error) throw new Error(`Erro ao deletar: ${error.message}`);
    },
  };
}

export const base44 = {
  entities: {
    Match: createEntityClient("matches"),
    LeagueProfile: createEntityClient("league_profiles"),
  },
};
