"use client";

import { useEffect, useState } from "react";
import { Check, Globe, X } from "lucide-react";
import { HeaderButton } from "./PageHeader";

// Country filter with a flag grid: many flags visible at once, several can be ticked.
// Same pattern as "Select countries" in the QuizzBattle invite flow, but fed with the
// countries that actually occur in the list it filters, so nothing can come back empty.
export interface CountryOption {
  key: string;   // stable id (the flag URL: "USA" and "United States" share one)
  label: string;
  n: number;
  flag: string;  // image URL
}

export default function CountryFilterMenu({
  options, value, onChange, className = "",
}: {
  options: CountryOption[];
  value: string[];
  onChange: (keys: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const selected = options.filter(o => value.includes(o.key));
  const label = selected.length === 0 ? "Country" : selected.length === 1 ? selected[0].label : `${selected.length} countries`;
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);

  return (
    <div className={`relative ${className}`}>
      <HeaderButton icon={Globe} label={label} active={selected.length > 0} onClick={() => setOpen(o => !o)} />

      {open && (
        <>
          {/* click outside closes */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[min(34rem,calc(100vw-2rem))] bg-white border border-warm rounded-xl shadow-xl p-3">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
              <span className="font-display text-sm tracking-wider text-gray-900 uppercase">Select countries</span>
              <div className="flex items-center gap-1">
                {value.length > 0 && (
                  <button onClick={() => onChange([])} className="text-xs text-gray-500 hover:text-[#E36B11] px-2 py-1 rounded hover:bg-gray-100">
                    Clear all ({value.length})
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close" className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {options.map(o => {
                const on = value.includes(o.key);
                return (
                  <button
                    key={o.key}
                    onClick={() => toggle(o.key)}
                    aria-pressed={on}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      on ? "bg-[#E36B11] border-[#E36B11] text-white" : "bg-white border-gray-200 hover:border-[#E36B11]/50 hover:bg-[#E36B11]/5 text-gray-700"
                    }`}
                  >
                    <img src={o.flag} srcSet={`${o.flag.replace("24x18", "48x36")} 2x`} alt="" className="w-6 h-[18px] object-cover rounded-[2px] flex-shrink-0 shadow-sm" />
                    <span className="flex-1 min-w-0 text-xs truncate">{o.label}</span>
                    {on ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <span className="text-[10px] text-gray-400 flex-shrink-0">{o.n}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
