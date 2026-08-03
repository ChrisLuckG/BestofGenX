"use client";

import { Pencil } from "lucide-react";
import { RosterPerson } from "./types";
import { COLOR_CYCLE, DEPT_THEME, DepartmentId } from "./constants";

interface ReporterChipsProps {
  roster: RosterPerson[];
  activeReporters: Record<string, boolean>;
  activeDept: DepartmentId;
  onToggle: (personId: string) => void;
  onEdit: (person: RosterPerson) => void;
}

export default function ReporterChips({
  roster,
  activeReporters,
  activeDept,
  onToggle,
  onEdit,
}: ReporterChipsProps) {
  const theme = DEPT_THEME[activeDept];

  function colorFor(personId: string) {
    const idx = roster.findIndex(p => p.id === personId);
    return COLOR_CYCLE[idx % COLOR_CYCLE.length];
  }

  return (
    <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
      {roster.map(p => (
        <div key={p.id} className="relative group">
          <button
            onClick={() => onToggle(p.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-xs ${
              activeReporters[p.id] 
                ? theme.rosterActive 
                : "bg-gray-900 border-gray-700 hover:border-gray-500"
            }`}
          >
            {p.avatar ? (
              <img src={p.avatar} alt={p.name} className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-black ${colorFor(p.id).bg}`}>
                {p.name.split(' ').map(n => n[0]).join('')}
              </div>
            )}
            <span className={`font-medium ${activeReporters[p.id] ? "text-black" : "text-gray-300"}`}>
              {p.name.split(' ')[0]}
            </span>
          </button>
          {/* Edit button - appears on hover */}
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(p); }}
            className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 hover:bg-[#D4873A] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit reporter"
          >
            <Pencil size={8} className="text-white" />
          </button>
        </div>
      ))}
    </div>
  );
}
