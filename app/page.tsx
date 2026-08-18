'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import type { Subscriber } from '@/lib/types'

function PageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const [view, setView] = useState<'landing' | 'loading'>('landing')
  const [operator, setOperator] = useState<Subscriber | null>(null)

  useEffect(() => {
    const operatorId = params.get('u')

    if (operatorId) {
      // Loading booking page for this operator
      setView('loading')
      loadOperator(operatorId)
    }
  }, [params])

  async function loadOperator(id: string) {
    const { data, error } = await supabase
      .from('subscribers')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error('Operator not found:', error)
      setView('landing')
      return
    }

    if (data.status !== 'active') {
      setView('landing')
      return
    }

    setOperator(data)
    router.push(`/b/${id}`)
  }

  if (view === 'loading') {
    return (
      <div className="container-max flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    )
  }

  return (
    <div className="container-max">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-10 text-white mb-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-300 rounded-full opacity-10 -mr-24 -mt-24"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white rounded-full opacity-5 -ml-10 -mb-15"></div>

        <div className="relative z-10">
          <div className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">HelloNeighbor</div>
          <h1 className="text-4xl font-bold mb-3 leading-tight">
            Run your own<br />
            <span className="text-yellow-300">neighborhood business</span>
          </h1>
          <p className="text-sm opacity-80 mb-6 max-w-xs">
            Set your services, prices & schedule. Neighbors book online. You get paid.
          </p>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => router.push('/join')}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg text-base transition"
            >
              🚀 Start my business
            </button>
            <button
              onClick={() => router.push('/login')}
              className="bg-white/15 hover:bg-white/25 text-white font-semibold py-3 px-6 rounded-lg text-base border border-white/30 transition"
            >
              👤 I already have an account
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-3xl mb-2">🗑️🚗🐕</div>
          <div className="text-xs text-gray-500 mt-2">Pick your services</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-xs text-gray-500 mt-2">Set your schedule</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-xs text-gray-500 mt-2">Neighbors book & pay</div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-center mb-5">
        <p className="text-sm">
          Already on HelloNeighbor?{' '}
          <button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-semibold ml-2 transition"
          >
            Log in
          </button>
        </p>
      </div>

      <div className="text-center mb-8">
        <button
          onClick={() => router.push('/admin/login')}
          className="text-xs opacity-40 hover:opacity-60 transition"
        >
          Admin login
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div className="container-max flex items-center justify-center min-h-screen">Loading...</div>}>
      <PageContent />
    </Suspense>
  )
}
