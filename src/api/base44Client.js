import { supabase } from "@/lib/supabaseClient";

function createEntityClient(tableName) {
  return {
    async create(data) {
      const { data: row, error } = await supabase
        .from(tableName).insert(data).select().single();
      if (error) throw error;
      return row;
    },
    async list(sort = "-created_date", limit = 100) {
      const desc = sort.startsWith("-");
      const col = sort.replace("-", "");
      const { data: rows, error } = await supabase
        .from(tableName)
        .select("*")
        .order(col, { ascending: !desc })
        .limit(limit);
      if (error) throw error;
      return rows;
    },
    async get(id) {
      const { data: row, error } = await supabase
        .from(tableName).select("*").eq("id", id).single();
      if (error) throw error;
      return row;
    },
    async update(id, data) {
      const { data: row, error } = await supabase
        .from(tableName).update(data).eq("id", id).select().single();
      if (error) throw error;
      return row;
    },
    async delete(id) {
      const { error } = await supabase
        .from(tableName).delete().eq("id", id);
      if (error) throw error;
    },
  };
}

export const base44 = {
  entities: {
    Match: createEntityClient("matches"),
    LeagueProfile: createEntityClient("league_profiles"),
  },
};
