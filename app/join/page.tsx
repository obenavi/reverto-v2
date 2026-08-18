'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function JoinPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    area: '',
    age: '',
    bio: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate required fields
      if (!formData.name || !formData.phone) {
        setError('Please enter your name and phone.')
        setLoading(false)
        return
      }

      // Check if phone already exists
      const { data: existing } = await supabase
        .from('subscribers')
        .select('id')
        .eq('phone', formData.phone)
        .single()

      if (existing) {
        setError('This phone is already registered.')
        setLoading(false)
        return
      }

      // Create new subscriber (pending status)
      const { data, error: insertError } = await supabase
        .from('subscribers')
        .insert([
          {
            name: formData.name,
            phone: formData.phone,
            area: formData.area || 'Not specified',
            age: parseInt(formData.age) || 0,
            bio: formData.bio,
            status: 'pending',
          },
        ])
        .select()
        .single()

      if (insertError) {
        setError('Failed to submit application. Please try again.')
        console.error(insertError)
        setLoading(false)
        return
      }

      // TODO: Send Telegram notification to admin
      // TODO: Send SMS confirmation to applicant

      setSuccess(true)
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="container-max text-center py-20">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold mb-3">Application received!</h2>
        <p className="text-gray-600 mb-6 max-w-sm mx-auto">
          We'll give you a call soon to get you set up. Once approved, you'll get your own booking page and QR code!
        </p>

        <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-left max-w-sm mx-auto mb-8">
          <strong className="block mb-2">What happens next:</strong>
          <ol className="text-sm space-y-1">
            <li>1. We call you to say hi 👋</li>
            <li>2. You or your mom sends payment</li>
            <li>3. We activate your account</li>
            <li>4. You set up your services & go!</li>
          </ol>
        </div>

        <button
          onClick={() => router.push('/')}
          className="text-sm opacity-50 hover:opacity-70 transition"
        >
          ← Back to home
        </button>
      </div>
    )
  }

  return (
    <div className="container-max max-w-md mx-auto py-8">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🚀</div>
        <h1 className="text-2xl font-bold mb-2">Start your business</h1>
        <p className="text-sm text-gray-600">Fill in your info — we'll reach out to get you set up!</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Your name</label>
          <input
            type="text"
            name="name"
            placeholder="e.g. Alex"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone number</label>
          <input
            type="tel"
            name="phone"
            placeholder="(555) 000-0000"
            value={formData.phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Your neighborhood / city</label>
          <input
            type="text"
            name="area"
            placeholder="e.g. Hidden Hills, CA"
            value={formData.area}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-700 mb-1">Your age</label>
          <input
            type="number"
            name="age"
            placeholder="e.g. 14"
            value={formData.age}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-700 mb-1">Tell us about yourself (optional)</label>
          <textarea
            name="bio"
            placeholder="What services do you want to offer? Any skills or experience?"
            value={formData.bio}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-blue-600 resize-none"
          />
        </div>

        {error && <div className="text-red-600 text-sm mb-4 text-center">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg text-base transition mb-4"
        >
          {loading ? 'Submitting...' : 'Send my application →'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full text-center text-sm opacity-50 hover:opacity-70 transition"
        >
          ← Back
        </button>
      </form>
    </div>
  )
}
