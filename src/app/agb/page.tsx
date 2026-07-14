"use client";

import StaticPageLayout from "@/components/StaticPageLayout";

export default function AGBPage() {
  return (
    <StaticPageLayout title="AGB">
      <div>
        <div className="prose prose-sm max-w-none text-gray-700">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Allgemeine Geschäftsbedingungen (AGB)</h2>
          
          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 1 Geltungsbereich</h3>
          <p className="mb-4 text-sm">
            Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Plattform 
            "Best of GenX" (nachfolgend "Plattform"). Mit der Registrierung und Nutzung 
            der Plattform akzeptieren Sie diese AGB.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 2 Leistungsbeschreibung</h3>
          <p className="mb-4 text-sm">
            Best of GenX ist eine Entertainment-Plattform, die folgende Dienste anbietet:
          </p>
          <ul className="list-disc list-inside mb-4 text-sm space-y-1">
            <li>Quiz- und Trivia-Spiele</li>
            <li>Multiplayer-Battles</li>
            <li>Predictions und Voting</li>
            <li>Artikel und redaktionelle Inhalte</li>
            <li>Curated Spotify-Playlists</li>
            <li>Punktesystem und virtuelle Belohnungen</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 3 Registrierung und Konto</h3>
          <p className="mb-4 text-sm">
            (1) Für die vollständige Nutzung der Plattform ist eine Registrierung erforderlich.<br />
            (2) Sie sind verpflichtet, wahrheitsgemäße Angaben zu machen.<br />
            (3) Ihr Konto ist nicht übertragbar.<br />
            (4) Sie sind für die Geheimhaltung Ihrer Zugangsdaten verantwortlich.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 4 Punktesystem</h3>
          <p className="mb-4 text-sm">
            (1) Punkte können durch verschiedene Aktivitäten verdient werden (Spiele, Artikel lesen, etc.).<br />
            (2) Punkte haben keinen monetären Wert und können nicht ausgezahlt werden.<br />
            (3) Punkte können für virtuelle Belohnungen im Shop eingelöst werden.<br />
            (4) Bei Verstoß gegen die AGB können Punkte abgezogen oder das Konto gesperrt werden.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 5 Verhaltensregeln</h3>
          <p className="mb-4 text-sm">
            Bei der Nutzung der Plattform ist es untersagt:
          </p>
          <ul className="list-disc list-inside mb-4 text-sm space-y-1">
            <li>Beleidigende, rassistische oder diskriminierende Inhalte zu verbreiten</li>
            <li>Das System durch Bots oder automatisierte Skripte zu manipulieren</li>
            <li>Mehrere Konten zu erstellen, um Vorteile zu erlangen</li>
            <li>Andere Nutzer zu belästigen oder zu bedrohen</li>
            <li>Urheberrechtlich geschützte Inhalte ohne Erlaubnis zu teilen</li>
          </ul>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 6 Geistiges Eigentum</h3>
          <p className="mb-4 text-sm">
            (1) Alle Inhalte der Plattform (Texte, Grafiken, Logos, Quizfragen) sind urheberrechtlich geschützt.<br />
            (2) Die Nutzung ist nur im Rahmen der Plattform gestattet.<br />
            (3) Eine kommerzielle Nutzung ohne schriftliche Genehmigung ist untersagt.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 7 Haftung</h3>
          <p className="mb-4 text-sm">
            (1) Die Plattform wird "wie besehen" bereitgestellt.<br />
            (2) Wir übernehmen keine Garantie für ununterbrochene Verfügbarkeit.<br />
            (3) Für Schäden durch Nutzung der Plattform haften wir nur bei Vorsatz oder grober Fahrlässigkeit.<br />
            (4) Für externe Links übernehmen wir keine Haftung.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 8 Kündigung</h3>
          <p className="mb-4 text-sm">
            (1) Sie können Ihr Konto jederzeit löschen.<br />
            (2) Wir behalten uns das Recht vor, Konten bei Verstößen gegen diese AGB zu sperren.<br />
            (3) Bei Löschung verfallen alle gesammelten Punkte.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 9 Änderungen der AGB</h3>
          <p className="mb-4 text-sm">
            Wir behalten uns vor, diese AGB jederzeit zu ändern. Über wesentliche Änderungen 
            werden registrierte Nutzer per E-Mail informiert.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">§ 10 Schlussbestimmungen</h3>
          <p className="mb-4 text-sm">
            (1) Es gilt deutsches Recht.<br />
            (2) Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
          </p>

          <h3 className="text-lg font-bold text-gray-900 mt-6 mb-3">Kontakt</h3>
          <p className="mb-4 text-sm">
            Bei Fragen zu diesen AGB erreichen Sie uns unter:<br />
            E-Mail: <a href="mailto:contact@bestofgenx.com" className="text-[#D4873A] hover:underline">contact@bestofgenx.com</a>
          </p>

          <p className="text-xs text-gray-500 mt-8">
            Stand: Juni 2026
          </p>
        </div>
      </div>
    </StaticPageLayout>
  );
}
