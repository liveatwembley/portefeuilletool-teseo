'use client'
import { useState } from 'react'
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    api.clearToken()
    router.push('/login')
  }

  const handleNav = (href: string) => {
    router.push(href)
    setMobileMenuOpen(false)
  }

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/')

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* --- LOGO --- */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1B3A5C] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">Teseo</h1>
              <p className="hidden md:block text-[10px] text-slate-400 leading-tight tracking-wider uppercase">
                Bluebird Capital
              </p>
            </div>
          </div>

          {/* --- DESKTOP NAV --- */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => handleNav(item.href)}
                className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'text-slate-900'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive(item.href) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-0.5 rounded-full bg-[#E8B34A]" />
                )}
              </button>
            ))}
          </nav>

          {/* --- RIGHT SIDE --- */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Uitloggen
            </button>

            {/* --- HAMBURGER --- */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
              aria-label="Menu"
            >
              <span
                className={`block w-5 h-0.5 bg-slate-600 rounded-full transition-transform duration-200 ${
                  mobileMenuOpen ? 'translate-y-[4px] rotate-45' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-slate-600 rounded-full transition-opacity duration-200 ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-slate-600 rounded-full transition-transform duration-200 ${
                  mobileMenuOpen ? '-translate-y-[4px] -rotate-45' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE MENU --- */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height] duration-300 ease-in-out ${
          mobileMenuOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <nav className="border-t border-slate-200/60 bg-white/95 backdrop-blur-xl px-4 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              className={`flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-slate-900 bg-slate-50 border-l-2 border-[#E8B34A]'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
