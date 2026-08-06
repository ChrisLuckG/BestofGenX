"use client";

import { X } from "lucide-react";
import { PROMPT_TEMPLATES, SEARCH_CATEGORIES, SEARCH_COUNTRIES } from "./constants";

interface TemplatePanelProps {
  selectedTemplate: string;
  globalCategory: string;
  globalCountry: string;
  onSelectTemplate: (templateId: string, prompt: string) => void;
  onCategoryChange: (category: string) => void;
  onCountryChange: (country: string) => void;
  onClose: () => void;
}

export default function TemplatePanel({
  selectedTemplate,
  globalCategory,
  globalCountry,
  onSelectTemplate,
  onCategoryChange,
  onCountryChange,
  onClose,
}: TemplatePanelProps) {
  return (
    <div className="border-t border-gray-800 bg-gray-900/50 px-4 py-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-gray-500 font-mono">
          Quick Templates
        </span>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>

      {/* Template buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {PROMPT_TEMPLATES.map(t => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.id, t.prompt)}
            className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
              selectedTemplate === t.id
                ? 'bg-[#E36B11] border-[#E36B11] text-black'
                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-[#E36B11] hover:text-[#E36B11]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Category:</span>
          <select
            value={globalCategory}
            onChange={e => onCategoryChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:border-[#E36B11] focus:outline-none"
          >
            {SEARCH_CATEGORIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">Country:</span>
          <select
            value={globalCountry}
            onChange={e => onCountryChange(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:border-[#E36B11] focus:outline-none"
          >
            {SEARCH_COUNTRIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
