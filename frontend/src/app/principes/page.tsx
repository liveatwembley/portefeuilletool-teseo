const PRINCIPLES = [
  {
    nr: 1,
    title: 'Fundamentals',
    summary:
      'De kern van onze strategie rust op een diepgaande analyse van de fundamenten. We zoeken naar bedrijven met hoge, houdbare en groeiende omzet, cashflow en winst.',
  },
  {
    nr: 2,
    title: 'Waardering vs. Tijd',
    summary:
      'We zetten de fundamentele waarde af tegen de marktwaardering, maar kijken vooral twee tot vijf jaar vooruit.',
  },
  {
    nr: 3,
    title: 'Geen Turnarounds',
    summary:
      'We kiezen resoluut voor bedrijven die structureel gezond zijn. Geen herstelplannen, geen speculatie op beloftes.',
  },
  {
    nr: 4,
    title: 'QARP',
    summary:
      'Quality at a Reasonable Price. "Winnen door niet te verliezen." Kwaliteitsondernemingen met voorspelbare winstgroei van 8-12% CAGR.',
  },
  {
    nr: 5,
    title: 'Inspiratie Halen',
    summary:
      'Superinvestors, Dataroma, AI en fondsen als Scottish Mortgage als bron voor prospectie. Altijd eigen fundamenteel huiswerk.',
  },
  {
    nr: 6,
    title: 'Timing is Moeilijk',
    summary:
      'Focus op kwaliteit voor de lange termijn, niet op het voorspellen van korte termijn schommelingen. Minimaal 10 jaar horizon.',
  },
  {
    nr: 7,
    title: 'Water the Flowers',
    summary:
      'Versterk posities die fundamenteel en koersmatig goed presteren. Durf bij te kopen in een stijgende vlucht.',
  },
  {
    nr: 8,
    title: 'Niet te Veel Posities',
    summary:
      'Maximaal 30 posities voor 95% van het kapitaal. Micro-posities worden gelimiteerd en regelmatig opgeschoond.',
  },
  {
    nr: 9,
    title: 'Verkopen',
    summary:
      'Resoluut verkopen wanneer fundamenten wankelen of waardering onhoudbaar wordt. Strikte deadlines bij twijfel.',
  },
  {
    nr: 10,
    title: 'Niet te Veel Cash',
    summary:
      'Kapitaal maximaal laten werken. Buffett Indicator als toerenteller: <175% max 7.5%, <150% max 5%, <125% max 2%.',
  },
  {
    nr: 11,
    title: 'De Som der Delen',
    summary:
      'Portefeuille als een geheel bewaken. Gezonde spreiding over sectoren, regio\'s, en balans tussen groei en QARP.',
  },
  {
    nr: 12,
    title: 'Second-order Thinking',
    summary:
      'Verder analyseren dan de directe impact. Kettingreacties vroegtijdig in kaart brengen voor risico\'s en kansen.',
  },
]

export default function PrincipesPage() {
  return (
    <div className="space-y-6">
      {/* --- HEADER --- */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Beleggingsprincipes
        </h1>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          12 principes &mdash; synthese januari 2026
        </p>
      </div>

      {/* --- GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PRINCIPLES.map((p) => (
          <div
            key={p.nr}
            className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 overflow-hidden"
          >
            {/* Number watermark */}
            <span className="absolute top-4 right-5 text-4xl font-bold text-[#E8B34A]/20 dark:text-[#E8B34A]/15 leading-none select-none pointer-events-none">
              {String(p.nr).padStart(2, '0')}
            </span>

            {/* Number badge + title */}
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E8B34A]/10 text-[#E8B34A] text-sm font-bold shrink-0">
                {p.nr}
              </span>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {p.title}
              </h2>
            </div>

            {/* Summary */}
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-11">
              {p.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
