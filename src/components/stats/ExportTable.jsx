import React from "react";

const COLUMNS = [
  { key: "date", label: "Data" },
  { key: "home_team", label: "Casa" },
  { key: "away_team", label: "Fora" },
  { key: "xc_total", label: "xC Total" },
  { key: "xg_total", label: "xG Total" },
  { key: "xs_total", label: "xS Total" },
  { key: "xcard_total", label: "xCard Total" },
  { key: "xfouls_total", label: "xFaltas Total" },
  { key: "xsaves_total", label: "xSaves Total" },
  { key: "xtotalshots_total", label: "xChutes Total" },
  { key: "p_btts", label: "pBTTS" },
  { key: "fs_casa", label: "FS Casa" },
  { key: "fs_fora", label: "FS Fora" },
  { key: "real_corners_total", label: "Corners Real" },
  { key: "real_goals_total", label: "Gols Real" },
  { key: "real_cards_total", label: "Cards Real" },
  { key: "real_fouls_total", label: "Faltas Real" },
  { key: "real_saves_total", label: "Saves Real" },
  { key: "real_totalshots_total", label: "Chutes Real" },
  { key: "real_btts", label: "BTTS Real" },
];

export default function ExportTable({ data }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col.key} className="text-left px-3 py-2 font-semibold text-muted-foreground whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {data.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-slate-50">
              {COLUMNS.map((col) => (
                <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                  {row[col.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}