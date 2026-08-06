"use client";

import { X, Loader2, Save } from "lucide-react";
import { Pencil } from "lucide-react";
import { EditingReporter } from "./types";
import { REPORTER_REGIONS } from "./constants";

interface ReporterEditModalProps {
  reporter: EditingReporter;
  saving: boolean;
  onChange: (reporter: EditingReporter) => void;
  onSave: () => void;
  onClose: () => void;
}

export default function ReporterEditModal({
  reporter,
  saving,
  onChange,
  onSave,
  onClose,
}: ReporterEditModalProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-800 rounded-xl w-full max-w-lg">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Pencil size={14} className="text-[#E36B11]" />
            Edit Reporter: {reporter.name}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Nationality */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Nationality</label>
            <input
              type="text"
              value={reporter.nationality}
              onChange={e => onChange({ ...reporter, nationality: e.target.value })}
              placeholder="e.g. British, American, Japanese..."
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
            />
          </div>

          {/* Region */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Region</label>
            <select
              value={reporter.region}
              onChange={e => onChange({ ...reporter, region: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
            >
              {REPORTER_REGIONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Specialty */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Specialty</label>
            <select
              value={reporter.specialty}
              onChange={e => onChange({ ...reporter, specialty: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
            >
              <option value="">— Any —</option>
              <option value="sports">🏆 Sports</option>
              <option value="music">🎵 Music</option>
              <option value="movies-tv">📺 Movies/TV</option>
              <option value="gaming">🎮 Gaming</option>
              <option value="politics">🏛️ Politics</option>
              <option value="lifestyle">✨ Lifestyle</option>
              <option value="tech">💻 Tech</option>
              <option value="rip">🕯️ RIP/Obituaries</option>
            </select>
          </div>

          {/* Writing Style */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Writing Style</label>
            <input
              type="text"
              value={reporter.writingStyle}
              onChange={e => onChange({ ...reporter, writingStyle: e.target.value })}
              placeholder="e.g. nick-hornby, hunter-s-thompson..."
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none"
            />
          </div>

          {/* Personality */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Personality</label>
            <textarea
              value={reporter.personality}
              onChange={e => onChange({ ...reporter, personality: e.target.value })}
              placeholder="Describe their personality, tone, quirks..."
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none resize-none"
            />
          </div>

          {/* Responsibilities */}
          <div>
            <label className="block text-[10px] text-gray-400 mb-1 uppercase">Responsibilities</label>
            <textarea
              value={reporter.responsibilities}
              onChange={e => onChange({ ...reporter, responsibilities: e.target.value })}
              placeholder="What topics do they cover?"
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-sm focus:border-[#E36B11] focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-[#E36B11] hover:bg-[#c07830] rounded text-xs font-bold text-white flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
