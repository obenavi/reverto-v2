'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [otp, setOtp] = useState('')

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Check if operator exists
      const { data: operator, error: queryError } = await supabase
        .from('subscribers')
        .select('id, status')
        .eq('phone', phone)
        .single()

      if (queryError || !operator) {
        setError('No account found with that number. Join below!')
        setLoading(false)
        return
      }

      if (operator.status === 'pending') {
        setError("Your account is pending approval — we'll call you soon!")
        setLoading(false)
        return
      }

      if (operator.status === 'suspended') {
        setError('Your account has been suspended. Contact us.')
        setLoading(false)
        return
      }

      // TODO: Send OTP via Supabase Auth or Twilio
      setStep('otp')
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // TODO: Verify OTP and create session
      // For now, using phone to authenticate
      const { data: operator, error: queryError } = await supabase
        .from('subscribers')
        .select('id')
        .eq('phone', phone)
        .single()

      if (queryError || !operator) {
        setError('Authentication failed.')
        setLoading(false)
        return
      }

      // Store operator ID in session/localStorage
      localStorage.setItem('operatorId', operator.id)

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-max max-w-sm mx-auto py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Welcome back!</h1>
        <p className="text-sm text-gray-600">Enter your phone number to continue</p>
      </div>

      {step === 'phone' ? (
        <form onSubmit={handlePhoneSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-700 mb-2">Phone number</label>
            <input
              type="tel"
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
            />
          </div>

          {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-base transition mb-4"
          >
            {loading ? 'Checking...' : 'Continue →'}
          </button>

          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 text-gray-600 hover:text-gray-800 transition opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => router.push('/join')}
              className="flex-1 text-blue-600 hover:text-blue-700 opacity-70 transition"
            >
              New? Join here →
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
          <p className="text-sm text-gray-600 mb-4">
            We sent an OTP to {phone}
          </p>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-700 mb-2">Enter OTP</label>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
              maxLength="6"
            />
          </div>

          {error && <div className="text-red-600 text-sm mb-4">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-base transition mb-4"
          >
            {loading ? 'Verifying...' : 'Continue →'}
          </button>

          <button
            type="button"
            onClick={() => setStep('phone')}
            className="w-full text-center text-sm opacity-50 hover:opacity-70 transition"
          >
            ← Back
          </button>
        </form>
      )}
    </div>
  )
}
