'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Check password (use environment variable in production)
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'demo123'

    if (password === correctPassword) {
      sessionStorage.setItem('adminAuth', 'true')
      router.push('/admin')
    } else {
      setError('Wrong password.')
      setLoading(false)
    }
  }

  return (
    <div className="container-max max-w-sm mx-auto py-12">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">⚙️</div>
        <h1 className="text-2xl font-bold mb-2">Admin login</h1>
        <p className="text-sm text-gray-600">Enter admin password</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
            autoFocus
          />
        </div>

        {error && <div className="text-red-600 text-sm mb-4 text-center">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-base transition mb-4"
        >
          {loading ? 'Checking...' : 'Continue →'}
        </button>

        <button
          type="button"
          onClick={() => window.history.back()}
          className="w-full text-center text-sm opacity-50 hover:opacity-70 transition"
        >
          ← Back
        </button>
      </form>
    </div>
  )
}
