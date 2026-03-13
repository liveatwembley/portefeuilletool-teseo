'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import { useTheme } from '@/components/ThemeProvider'

const NAV_ITEMS = [
  { label: 'Overzicht', href: '/dashboard/overzicht' },
  { label: 'X-Ray', href: '/dashboard/x-ray' },
  { label: 'Rendement', href: '/dashboard/rendement' },
  { label: 'Holdings', href: '/dashboard/holdings' },
  { label: 'Earnings', href: '/earnings' },
  { label: 'Posities', href: '/posities' },
  { label: 'Transacties', href: '/transacties' },
  { label: 'Data Sync', href: '/data-sync' },
  { label: 'Principes', href: '/principes' },
]

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()

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
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60">
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* --- LOGO --- */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1B3A5C] flex items-center justify-center">
              <span className="text-white font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 leading-tight">Teseo</h1>
              <p className="hidden md:block text-[10px] text-slate-400 dark:text-slate-500 leading-tight tracking-wider uppercase">
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
                    ? 'text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={isDark ? 'Licht thema' : 'Donker thema'}
            >
              {isDark ? (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
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
                className={`block w-5 h-0.5 bg-slate-600 dark:bg-slate-400 rounded-full transition-transform duration-200 ${
                  mobileMenuOpen ? 'translate-y-[4px] rotate-45' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-slate-600 dark:bg-slate-400 rounded-full transition-opacity duration-200 ${
                  mobileMenuOpen ? 'opacity-0' : ''
                }`}
              />
              <span
                className={`block w-5 h-0.5 bg-slate-600 dark:bg-slate-400 rounded-full transition-transform duration-200 ${
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
        <nav className="border-t border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.href}
              onClick={() => handleNav(item.href)}
              className={`flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                isActive(item.href)
                  ? 'text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-l-2 border-[#E8B34A]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
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
