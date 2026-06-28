import ContourField from "@/components/ContourField";
import {
  IconQr, IconPin, IconPulse, IconShield, IconUsers,
  IconPhoneOff, IconClock, IconArrowDown, IconCheck, IconApple, IconPlay
} from "@/components/icons";

export default function Home() {
  return (
    <main className="overflow-x-hidden">
      {/* ───────────────────────── HERO ───────────────────────── */}
      <section className="relative bg-forest-900 text-forest-100 min-h-screen flex flex-col">
        <div className="absolute inset-0 text-forest-700/40">
          <ContourField className="w-full h-full" />
        </div>

        <nav className="relative z-10 flex items-center justify-between px-6 md:px-12 py-7 max-w-7xl mx-auto w-full">
          <span className="font-display text-2xl font-semibold tracking-tight text-white">
            Trailtag
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-forest-100/80">
            <a href="#wie-es-funktioniert" className="hover:text-white transition-colors">Wie es funktioniert</a>
            <a href="#funktionen" className="hover:text-white transition-colors">Funktionen</a>
            <a href="#download" className="hover:text-white transition-colors">App laden</a>
          </div>
          <a
            href="https://app.trailtag.ch/login"
            className="text-sm font-medium px-4 py-2 rounded-full border border-white/25 hover:bg-white/10 transition-colors"
          >
            Einloggen
          </a>
        </nav>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto -mt-10">
          <p className="font-display italic text-forest-100/70 text-lg mb-6">
            Für jeden, der allein in die Berge geht
          </p>
          <h1 className="font-display text-[2.75rem] leading-[1.05] md:text-7xl md:leading-[0.98] font-medium text-white mb-8">
            Wenn du nicht zurückkommst,<br />
            <span className="italic">muss niemand raten,</span><br />
            wo du warst.
          </h1>
          <p className="text-lg md:text-xl text-forest-100/75 max-w-xl mb-10 leading-relaxed">
            Ein Aufkleber am Auto. Im Notfall scannt ihn jeder Ersthelfer —
            ohne App, ohne Login — und sieht sofort deine Route, deinen
            letzten Standort und deine medizinischen Angaben.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#download"
              className="inline-flex items-center gap-2 bg-white text-forest-900 px-7 py-3.5 rounded-full font-medium hover:bg-forest-100 transition-colors"
            >
              <IconApple className="w-5 h-5" />
              App laden
            </a>
            <a
              href="#wie-es-funktioniert"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium border border-white/30 hover:bg-white/10 transition-colors"
            >
              Wie es funktioniert
            </a>
          </div>
        </div>

        <div className="relative z-10 pb-8 flex justify-center">
          <IconArrowDown className="w-5 h-5 text-forest-100/40 animate-bounce" />
        </div>
      </section>

      {/* ───────────────────────── PROBLEM ───────────────────────── */}
      <section className="bg-[#f7f6f2] py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="font-display italic text-forest-700 text-lg mb-4">Die Lücke</p>
          <h2 className="font-display text-3xl md:text-5xl font-medium text-forest-950 leading-tight max-w-3xl mb-16">
            Dein Handy hat keinen Empfang.<br />Deine Notfallkontakte wissen nicht, wo du bist.
          </h2>

          <div className="grid md:grid-cols-3 gap-10 md:gap-14">
            <div>
              <IconPhoneOff className="w-9 h-9 text-forest-700 mb-5" strokeWidth={1.4} />
              <h3 className="font-display text-xl font-medium text-forest-950 mb-2">Kein Netz im Gebirge</h3>
              <p className="text-forest-950/60 leading-relaxed">
                Ab einer gewissen Höhe ist dein Telefon nur noch ein Ziegelstein.
                Die wichtigste Information liegt darauf gesperrt fest.
              </p>
            </div>
            <div>
              <IconClock className="w-9 h-9 text-forest-700 mb-5" strokeWidth={1.4} />
              <h3 className="font-display text-xl font-medium text-forest-950 mb-2">Verlorene Zeit</h3>
              <p className="text-forest-950/60 leading-relaxed">
                Rettungskräfte verbringen oft die ersten kritischen Stunden
                allein mit der Suche nach dem Startpunkt deiner Tour.
              </p>
            </div>
            <div>
              <IconUsers className="w-9 h-9 text-forest-700 mb-5" strokeWidth={1.4} />
              <h3 className="font-display text-xl font-medium text-forest-950 mb-2">Niemand wusste Bescheid</h3>
              <p className="text-forest-950/60 leading-relaxed">
                "Ich dachte, er sei um vier zurück" ist der Satz, den
                niemand zu spät sagen will.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── WIE ES FUNKTIONIERT ───────────────────────── */}
      <section id="wie-es-funktioniert" className="bg-forest-950 text-forest-100 py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="font-display italic text-forest-100/60 text-lg mb-4">Das Prinzip</p>
          <h2 className="font-display text-3xl md:text-5xl font-medium text-white leading-tight max-w-2xl mb-20">
            Drei Schritte, bevor du auch nur die Stiefel schnürst.
          </h2>

          <div className="space-y-16 md:space-y-24">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <span className="font-display text-6xl text-forest-700/50 block mb-4">I</span>
                <h3 className="font-display text-2xl font-medium text-white mb-3">Plane deine Tour in der App</h3>
                <p className="text-forest-100/65 leading-relaxed max-w-md">
                  Route, geschätzte Rückkehrzeit, Begleitpersonen, medizinische
                  Angaben — einmal eingerichtet, jedes Mal in Sekunden bestätigt.
                </p>
              </div>
              <div className="bg-forest-900/60 rounded-2xl p-10 flex items-center justify-center border border-white/5">
                <IconPin className="w-16 h-16 text-forest-700" strokeWidth={1.2} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="md:order-2">
                <span className="font-display text-6xl text-forest-700/50 block mb-4">II</span>
                <h3 className="font-display text-2xl font-medium text-white mb-3">Der Aufkleber wartet am Auto</h3>
                <p className="text-forest-100/65 leading-relaxed max-w-md">
                  Ein wetterfester QR-Code am Fahrzeug am Trailhead. Er
                  verknüpft sich automatisch mit deiner aktiven Tour — du
                  musst nichts tun.
                </p>
              </div>
              <div className="md:order-1 bg-forest-900/60 rounded-2xl p-10 flex items-center justify-center border border-white/5">
                <IconQr className="w-16 h-16 text-forest-700" strokeWidth={1.2} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div>
                <span className="font-display text-6xl text-[#ba1a1a]/50 block mb-4">III</span>
                <h3 className="font-display text-2xl font-medium text-white mb-3">Im Notfall scannt jeder den Code</h3>
                <p className="text-forest-100/65 leading-relaxed max-w-md">
                  Polizei, Bergrettung, eine vorbeigehende Person — sie sehen
                  sofort deine Route, deinen letzten GPS-Punkt, deine
                  Allergien und Notfallkontakte. Kein App-Download nötig.
                </p>
              </div>
              <div className="bg-[#ba1a1a]/10 rounded-2xl p-10 flex items-center justify-center border border-[#ba1a1a]/20">
                <IconPulse className="w-16 h-16 text-[#ba1a1a]" strokeWidth={1.2} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────── FUNKTIONEN ───────────────────────── */}
      <section id="funktionen" className="bg-[#f7f6f2] py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="font-display italic text-forest-700 text-lg mb-4">Im Detail</p>
          <h2 className="font-display text-3xl md:text-5xl font-medium text-forest-950 leading-tight max-w-2xl mb-16">
            Gebaut für das Gelände, nicht fürs Büro.
          </h2>

          <div className="grid md:grid-cols-3 gap-px bg-forest-950/10 rounded-2xl overflow-hidden">
            {[
              { icon: IconClock, title: "Automatischer Alarm", body: "Erreichst du deine Rückkehrzeit nicht, eskaliert das System selbst — erst Push, dann SMS an deine Kontakte." },
              { icon: IconUsers, title: "Begleitung im Blick", body: "Freunde sehen live, wenn jemand von euch überfällig ist. Keine Reload-Knöpfe, keine Unsicherheit." },
              { icon: IconShield, title: "Medizinische Daten", body: "Blutgruppe, Allergien, Medikamente — nur im Ernstfall sichtbar, sonst privat." },
              { icon: IconPin, title: "GPS-Verlauf", body: "Dein letzter bekannter Standort und die letzten Wegpunkte, präzise genug für eine Suchaktion." },
              { icon: IconQr, title: "Kein App-Zwang für Retter", body: "Der QR-Code öffnet eine einfache Webseite. Niemand muss etwas installieren, um dir zu helfen." },
              { icon: IconPulse, title: "Vier Eskalationsstufen", body: "Vorwarnung, Status-Wechsel, SMS an Kontakte, SMS an Notfalldienste — jede Stufe greift erst, wenn die vorherige nicht reichte." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-[#f7f6f2] p-8 md:p-10">
                <Icon className="w-8 h-8 text-forest-700 mb-5" strokeWidth={1.4} />
                <h3 className="font-display text-lg font-medium text-forest-950 mb-2">{title}</h3>
                <p className="text-forest-950/60 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────── VERTRAUEN ───────────────────────── */}
      <section className="bg-forest-700 text-white py-20 md:py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-medium leading-snug mb-6">
            Entwickelt von jemandem, der selbst allein in den
            Schweizer Bergen unterwegs ist.
          </h2>
          <p className="text-white/75 text-lg leading-relaxed">
            Trailtag ist kein Konzern-Produkt. Es ist die Antwort auf eine
            einfache Frage: Was, wenn mir dort oben etwas passiert und niemand
            es merkt?
          </p>
        </div>
      </section>

      {/* ───────────────────────── DOWNLOAD ───────────────────────── */}
      <section id="download" className="bg-forest-950 text-white py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="font-display italic text-forest-100/60 text-lg mb-4">Bereit für die nächste Tour?</p>
          <h2 className="font-display text-3xl md:text-5xl font-medium leading-tight mb-10">
            Lade Trailtag und richte deinen ersten Aufkleber ein.
          </h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-white text-forest-950 px-7 py-3.5 rounded-full font-medium hover:bg-forest-100 transition-colors"
            >
              <IconApple className="w-5 h-5" />
              Im App Store laden
            </a>
            <a
              href="app.trailtag.ch/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium border border-white/30 hover:bg-white/10 transition-colors"
            >
              <IconPlay className="w-4 h-4" />
              Im Browser ausprobieren
            </a>
          </div>
          <p className="text-forest-100/50 text-sm flex items-center justify-center gap-2">
            <IconCheck className="w-4 h-4" /> Kostenlos starten · Schweizer Server
          </p>
        </div>
      </section>

      {/* ───────────────────────── FOOTER ───────────────────────── */}
      <footer className="bg-forest-950 text-forest-100/50 px-6 py-10 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-sm">
          <span className="font-display text-white/70">Trailtag</span>
          <div className="flex gap-6">
            <a href="/impressum" className="hover:text-white transition-colors">Impressum</a>
            <a href="/datenschutz" className="hover:text-white transition-colors">Datenschutz</a>
            <a href="mailto:hallo@trailtag.ch" className="hover:text-white transition-colors">Kontakt</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
