import { Header } from '@/components/layout/Header'

export default function PositiesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-6 py-6">{children}</main>
    </div>
  )
}
