const PRINCIPLES = [
  {
    nr: 1,
    title: 'Fundamentals',
    summary: 'Hoge, houdbare en groeiende omzet, cashflow en winst als basis.',
  },
  {
    nr: 2,
    title: 'Waardering vs. Tijd',
    summary: 'Fundamentele waarde afzetten tegen marktwaardering, 2-5 jaar vooruit.',
  },
  {
    nr: 3,
    title: 'Geen Turnarounds',
    summary: 'Alleen structureel gezonde bedrijven. Geen herstelplannen of speculatie.',
  },
  {
    nr: 4,
    title: 'QARP',
    summary: 'Quality at a Reasonable Price. Voorspelbare winstgroei van 8-12% CAGR.',
  },
  {
    nr: 5,
    title: 'Inspiratie Halen',
    summary: 'Superinvestors, Dataroma, AI en fondsen als bron. Altijd eigen huiswerk.',
  },
  {
    nr: 6,
    title: 'Timing is Moeilijk',
    summary: 'Kwaliteit voor de lange termijn. Minimaal 10 jaar horizon.',
  },
  {
    nr: 7,
    title: 'Water the Flowers',
    summary: 'Versterk posities die fundamenteel en koersmatig presteren.',
  },
  {
    nr: 8,
    title: 'Niet te Veel Posities',
    summary: 'Max 30 posities voor 95% van het kapitaal. Micro-posities opschonen.',
  },
  {
    nr: 9,
    title: 'Verkopen',
    summary: 'Resoluut bij wankelende fundamenten of onhoudbare waardering.',
  },
  {
    nr: 10,
    title: 'Niet te Veel Cash',
    summary: 'Kapitaal maximaal laten werken. Buffett Indicator als toerenteller.',
  },
  {
    nr: 11,
    title: 'De Som der Delen',
    summary: 'Portefeuille als geheel: spreiding over sectoren, regio\'s, groei en QARP.',
  },
  {
    nr: 12,
    title: 'Second-order Thinking',
    summary: 'Kettingreacties vroegtijdig in kaart brengen voor risico\'s en kansen.',
  },
]

export default function PrincipesPage() {
  return (
    <div className="space-y-5">
      {/* --- HEADER --- */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
          Beleggingsprincipes
        </h1>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          Synthese januari 2026
        </p>
      </div>

      {/* --- GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRINCIPLES.map((p) => (
          <div
            key={p.nr}
            className="bg-white dark:bg-slate-800 rounded-md border border-slate-200/60 dark:border-slate-700/60 p-5"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#E8B34A]/10 dark:bg-[#E8B34A]/15 text-[#E8B34A] text-xs font-bold shrink-0">
                {p.nr}
              </span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {p.title}
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug pl-[34px]">
              {p.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
