"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface StaticPageLayoutProps {
  title: string;
  children: React.ReactNode;
}

export default function StaticPageLayout({ title, children }: StaticPageLayoutProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col">
      {/* App Header — matches main app */}
      <header className="sticky top-0 z-40 bg-[#F5F0E8] border-b border-[#E5DDD0] px-4 py-2.5 flex items-center gap-3 shadow-sm">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-full hover:bg-[#E36B11]/10 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <a href="/" className="flex items-center gap-2 flex-shrink-0">
          <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-6" />
        </a>
        <span className="text-sm font-semibold text-gray-700 truncate">{title}</span>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 pb-24">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5DDD0] bg-[#F5F0E8] px-4 py-6 text-center">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-gray-400 mb-3">
          <a href="/impressum" className="hover:text-[#E36B11] transition-colors">Impressum</a>
          <a href="/datenschutz" className="hover:text-[#E36B11] transition-colors">Datenschutz</a>
          <a href="/agb" className="hover:text-[#E36B11] transition-colors">AGB</a>
          <a href="/kontakt" className="hover:text-[#E36B11] transition-colors">Kontakt</a>
        </div>
        <p className="text-xs text-gray-300">© {new Date().getFullYear()} Best of GenX</p>
      </footer>
    </div>
  );
}
