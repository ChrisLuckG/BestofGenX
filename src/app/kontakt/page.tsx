"use client";

import { Mail, MessageCircle, Clock } from "lucide-react";
import StaticPageLayout from "@/components/StaticPageLayout";

export default function KontaktPage() {
  return (
    <StaticPageLayout title="Kontakt">
      <div>
        {/* Hero */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Wir freuen uns auf deine Nachricht!</h2>
          <p className="text-gray-600">
            Fragen, Feedback oder einfach nur Hallo sagen? Schreib uns!
          </p>
        </div>

        {/* Contact Card */}
        <div className="bg-gradient-to-br from-[#D4873A] to-[#C4772A] rounded-2xl p-6 text-white text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">E-Mail</h3>
          <a 
            href="mailto:contact@bestofgenx.com"
            className="text-lg font-medium hover:underline"
          >
            contact@bestofgenx.com
          </a>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-warm p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#D4873A]" />
              </div>
              <h4 className="font-bold text-gray-900">Antwortzeit</h4>
            </div>
            <p className="text-sm text-gray-600">
              Wir antworten in der Regel innerhalb von 24-48 Stunden.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-warm p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-[#D4873A]" />
              </div>
              <h4 className="font-bold text-gray-900">Feedback</h4>
            </div>
            <p className="text-sm text-gray-600">
              Deine Meinung ist uns wichtig! Sag uns was du denkst.
            </p>
          </div>
        </div>

        {/* FAQ Teaser */}
        <div className="bg-white rounded-2xl border border-warm p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Häufige Themen</h3>
          <div className="space-y-3">
            <div className="p-3 bg-[#D4873A]/5 rounded-lg">
              <p className="font-medium text-gray-900 text-sm">Account & Login</p>
              <p className="text-xs text-gray-600">Probleme beim Einloggen oder mit deinem Account</p>
            </div>
            <div className="p-3 bg-[#D4873A]/5 rounded-lg">
              <p className="font-medium text-gray-900 text-sm">Punkte & Belohnungen</p>
              <p className="text-xs text-gray-600">Fragen zum Punktesystem oder Shop</p>
            </div>
            <div className="p-3 bg-[#D4873A]/5 rounded-lg">
              <p className="font-medium text-gray-900 text-sm">Song Requests</p>
              <p className="text-xs text-gray-600">Vorschläge für unsere Spotify-Playlists</p>
            </div>
            <div className="p-3 bg-[#D4873A]/5 rounded-lg">
              <p className="font-medium text-gray-900 text-sm">Bug Reports</p>
              <p className="text-xs text-gray-600">Etwas funktioniert nicht wie erwartet</p>
            </div>
          </div>
        </div>

      </div>
    </StaticPageLayout>
  );
}
