"use client";

import { ArrowLeft, Mail, Download, FileText, Image, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PressePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-cream border-b border-warm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-[#E36B11]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Presse</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Presse & Medien</h2>
          <p className="text-gray-600">
            Informationen und Materialien für Journalisten und Medienvertreter.
          </p>
        </div>

        {/* About Section */}
        <div className="bg-white rounded-2xl border border-warm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Über Best of GenX</h3>
          <p className="text-sm text-gray-700 mb-4">
            Best of GenX ist die Entertainment-Plattform für die Generation X. Wir verbinden 
            Nostalgie mit modernem Gaming und Community-Features. Unsere Nutzer können:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-4">
            <li>Quiz-Battles über 80s, 90s und frühe 2000er spielen</li>
            <li>Curated Spotify-Playlists entdecken</li>
            <li>Artikel über Popkultur, Musik und Lifestyle lesen</li>
            <li>An Predictions und Votings teilnehmen</li>
            <li>Punkte sammeln und Belohnungen freischalten</li>
          </ul>
          <p className="text-sm text-gray-700">
            <strong>Zielgruppe:</strong> Generation X (geboren 1965-1980)<br />
            <strong>Launch:</strong> 2026<br />
            <strong>Plattform:</strong> Web (Mobile-First PWA)
          </p>
        </div>

        {/* Press Kit - Coming Soon */}
        <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl border border-gray-200 p-8 mb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Press Kit</h3>
          <p className="text-sm text-gray-500 mb-4">
            Logos, Screenshots und Pressematerialien werden in Kürze verfügbar sein.
          </p>
          <span className="inline-block px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-sm font-medium">
            Coming Soon
          </span>
        </div>

        {/* Key Facts */}
        <div className="bg-white rounded-2xl border border-warm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Key Facts</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-[#E36B11]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#E36B11]">80s-00s</p>
              <p className="text-xs text-gray-600">Nostalgie-Ära</p>
            </div>
            <div className="text-center p-4 bg-[#E36B11]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#E36B11]">GenX</p>
              <p className="text-xs text-gray-600">Zielgruppe</p>
            </div>
            <div className="text-center p-4 bg-[#E36B11]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#E36B11]">Quiz</p>
              <p className="text-xs text-gray-600">Core Feature</p>
            </div>
            <div className="text-center p-4 bg-[#E36B11]/5 rounded-xl">
              <p className="text-2xl font-bold text-[#E36B11]">PWA</p>
              <p className="text-xs text-gray-600">Technologie</p>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gradient-to-br from-[#E36B11] to-[#C4772A] rounded-2xl p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-2">Presseanfragen</h3>
          <p className="text-white/80 text-sm mb-4">
            Für Interviews, Kooperationen oder weitere Informationen:
          </p>
          <a 
            href="mailto:contact@bestofgenx.com?subject=Presseanfrage"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#E36B11] font-bold rounded-xl hover:bg-white/90 transition-colors"
          >
            <Mail className="w-5 h-5" />
            contact@bestofgenx.com
          </a>
        </div>

        <p className="text-xs text-gray-500 text-center mt-8">
          © 2026 Best of GenX · Alle Rechte vorbehalten
        </p>
      </div>
    </div>
  );
}
