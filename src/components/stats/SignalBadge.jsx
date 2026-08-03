import React from "react";

const colorMap = {
  green: "bg-emerald-100 text-emerald-800 border-emerald-200",
  yellow: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  gray: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function SignalBadge({ label, color, size = "sm" }) {
  const sizeClass = size === "lg" ? "px-3 py-1.5 text-sm font-semibold" : "px-2 py-0.5 text-xs font-medium";
  return (
    <span className={`inline-flex items-center rounded-full border ${colorMap[color] || colorMap.gray} ${sizeClass}`}>
      {label}
    </span>
  );
}