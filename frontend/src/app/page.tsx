'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const token = api.getToken()
    if (token) {
      router.push('/dashboard/overzicht')
    } else {
      router.push('/login')
    }
  }, [router])

  return null
}
