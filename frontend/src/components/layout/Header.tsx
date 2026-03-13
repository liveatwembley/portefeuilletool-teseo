'use client'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'

const NAV_ITEMS = [
  { label: 'Overzicht', href: '/dashboard/overzicht' },
  { label: 'X-Ray', href: '/dashboard/x-ray' },
  { label: 'Rendement', href: '/dashboard/rendement' },
  { label: 'Holdings', href: '/dashboard/holdings' },
  { label: 'Posities', href: '/posities' },
  { label: 'Transacties', href: '/transacties' },
  { label: 'Data Sync', href: '/data-sync' },
]

export function Header() {
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    api.clearToken()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1B3A5C] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">Teseo</h1>
              <p className="text-[10px] text-slate-400 leading-tight tracking-wider uppercase">AICB Equity Fund</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Uitloggen
          </button>
        </div>
      </div>
    </header>
  )
}
