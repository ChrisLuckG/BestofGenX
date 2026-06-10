"use client";

import { ArrowLeft, Mail, Heart, Zap, Users, Music, Gamepad2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function KarrierePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-cream border-b border-warm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-[#D4873A]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Karriere</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Join the GenX Team!</h2>
          <p className="text-gray-600">
            Werde Teil unserer Mission, die beste Nostalgie-Plattform für die Generation X zu bauen.
          </p>
        </div>

        {/* Why Join Us */}
        <div className="bg-white rounded-2xl border border-warm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Warum Best of GenX?</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Heart className="w-5 h-5 text-[#D4873A]" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Passion Project</p>
                <p className="text-xs text-gray-600">Von GenX für GenX</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-[#D4873A]" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Startup Vibes</p>
                <p className="text-xs text-gray-600">Schnell & agil</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Music className="w-5 h-5 text-[#D4873A]" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">80s/90s Culture</p>
                <p className="text-xs text-gray-600">Nostalgie pur</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-[#D4873A]" />
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Remote First</p>
                <p className="text-xs text-gray-600">Arbeite von überall</p>
              </div>
            </div>
          </div>
        </div>

        {/* Open Positions */}
        <div className="bg-white rounded-2xl border border-warm p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Wir suchen</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-[#D4873A]/5 rounded-xl border border-[#D4873A]/20">
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="w-5 h-5 text-[#D4873A]" />
                <h4 className="font-bold text-gray-900">Content Creator (80s/90s)</h4>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Du kennst jeden Song, jeden Film und jede TV-Serie aus den 80s und 90s? 
                Schreibe Quiz-Fragen und Artikel für unsere Community.
              </p>
              <span className="text-xs text-[#D4873A] font-medium">Freelance · Remote</span>
            </div>

            <div className="p-4 bg-[#D4873A]/5 rounded-xl border border-[#D4873A]/20">
              <div className="flex items-center gap-2 mb-2">
                <Music className="w-5 h-5 text-[#D4873A]" />
                <h4 className="font-bold text-gray-900">Playlist Curator</h4>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Erstelle und pflege unsere Spotify-Playlists. Von Techno über HipHop bis Rock - 
                du weißt was die Generation X hören will.
              </p>
              <span className="text-xs text-[#D4873A] font-medium">Freelance · Remote</span>
            </div>

            <div className="p-4 bg-[#D4873A]/5 rounded-xl border border-[#D4873A]/20">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-[#D4873A]" />
                <h4 className="font-bold text-gray-900">Community Manager</h4>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                Baue unsere Community auf und halte sie am Leben. Social Media, 
                User Engagement und Events.
              </p>
              <span className="text-xs text-[#D4873A] font-medium">Part-time · Remote</span>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="bg-gradient-to-br from-[#D4873A] to-[#C4772A] rounded-2xl p-6 text-white text-center">
          <h3 className="text-lg font-bold mb-2">Interesse?</h3>
          <p className="text-white/80 text-sm mb-4">
            Schick uns eine Mail mit deinem Profil und warum du zu Best of GenX passt.
          </p>
          <a 
            href="mailto:contact@bestofgenx.com?subject=Karriere bei Best of GenX"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#D4873A] font-bold rounded-xl hover:bg-white/90 transition-colors"
          >
            <Mail className="w-5 h-5" />
            contact@bestofgenx.com
          </a>
        </div>

        <p className="text-xs text-gray-500 text-center mt-8">
          Keine passende Stelle? Initiativbewerbungen sind willkommen!
        </p>
      </div>
    </div>
  );
}
