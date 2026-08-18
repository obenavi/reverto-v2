'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Subscriber, Service, Slot } from '@/lib/types'

type BookingStep = 0 | 1 | 2 | 3

export default function PublicBookingPage() {
  const params = useParams()
  const operatorId = params.operatorId as string

  const [operator, setOperator] = useState<Subscriber | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  // Booking flow state
  const [step, setStep] = useState<BookingStep>(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [clientInfo, setClientInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })

  useEffect(() => {
    loadOperatorData()
  }, [operatorId])

  async function loadOperatorData() {
    try {
      // Load operator
      const { data: op, error: opError } = await supabase
        .from('subscribers')
        .select('*')
        .eq('id', operatorId)
        .single()

      if (opError || !op || op.status !== 'active') {
        setLoading(false)
        return
      }

      setOperator(op)

      // Load services
      const { data: svc, error: svcError } = await supabase
        .from('services')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('active', true)

      if (!svcError && svc) {
        setServices(svc)
      }

      // Load available slots
      const { data: sl, error: slError } = await supabase
        .from('slots')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('booked', false)
        .gte('date', new Date().toISOString().split('T')[0])

      if (!slError && sl) {
        setSlots(sl)
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading operator data:', error)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container-max flex items-center justify-center min-h-screen">
        Loading...
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="container-max text-center py-20">
        <p className="text-gray-600">Operator not found or not active</p>
      </div>
    )
  }

  return (
    <div className="container-max">
      {/* Operator Header */}
      <div className="bg-white rounded-lg p-5 mb-4 border border-gray-200">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">Hey, I'm {operator.name}! 👋</h1>
            <p className="text-sm text-gray-600 mt-1">{operator.bio}</p>
            <div className="flex gap-2 mt-2">
              <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                ✓ Supervised
              </span>
              <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                📍 {operator.area}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex gap-2 mb-6">
        {[0, 1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition ${
              s < step
                ? 'bg-green-600'
                : s === step
                  ? 'bg-blue-600'
                  : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Step 0: Select Service */}
      {step === 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">What can I help you with?</h2>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => {
                  setSelectedService(service)
                  setStep(1)
                }}
                className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                  selectedService?.id === service.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-400'
                }`}
              >
                <div className="text-2xl mb-2">📦</div>
                <div className="font-semibold text-sm">{service.name}</div>
                <div className="text-blue-600 text-sm font-bold mt-2">from ${service.base_price}</div>
                <div className="text-xs text-gray-600 mt-2 line-clamp-2">{service.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Select Slot */}
      {step === 1 && selectedService && (
        <div>
          <button
            onClick={() => setStep(0)}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-lg font-bold mb-4">Pick a date & time</h2>

          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">Service: {selectedService.name}</p>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {slots.length === 0 ? (
                <p className="text-sm text-gray-500">No slots available. Try messaging me!</p>
              ) : (
                slots.map((slot) => (
                  <div
                    key={slot.id}
                    onClick={() => {
                      setSelectedSlot(slot)
                      setStep(2)
                    }}
                    className="p-3 border border-gray-200 rounded-lg hover:border-blue-400 cursor-pointer transition"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm">{slot.date}</div>
                        <div className="text-xs text-gray-600">
                          {slot.start_time} - {slot.end_time}
                        </div>
                      </div>
                      {slot.urgent && <span className="text-xs font-bold text-amber-600">⚡ URGENT</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Enter Details */}
      {step === 2 && selectedService && selectedSlot && (
        <div>
          <button
            onClick={() => setStep(1)}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-lg font-bold mb-4">Your details</h2>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Your name</label>
              <input
                type="text"
                placeholder="e.g. Sarah Johnson"
                value={clientInfo.name}
                onChange={(e) => setClientInfo({ ...clientInfo, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                placeholder="(555) 000-0000"
                value={clientInfo.phone}
                onChange={(e) => setClientInfo({ ...clientInfo, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email (optional)</label>
              <input
                type="email"
                value={clientInfo.email}
                onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
              <input
                type="text"
                placeholder="123 Main St"
                value={clientInfo.address}
                onChange={(e) => setClientInfo({ ...clientInfo, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
              <textarea
                placeholder="Dog's name, subject/grade, kids' ages..."
                value={clientInfo.notes}
                onChange={(e) => setClientInfo({ ...clientInfo, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
            </div>
          </div>

          <button
            onClick={() => setStep(3)}
            disabled={!clientInfo.name || !clientInfo.phone || !clientInfo.address}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition"
          >
            Review →
          </button>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && selectedService && selectedSlot && (
        <div>
          <button
            onClick={() => setStep(2)}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-lg font-bold mb-4">Review & confirm</h2>

          <div className="bg-white rounded-lg p-4 border border-gray-200 mb-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Service</div>
                <div className="font-semibold">{selectedService.name}</div>
              </div>
              <div>
                <div className="text-gray-600">Date</div>
                <div className="font-semibold">{selectedSlot.date}</div>
              </div>
              <div>
                <div className="text-gray-600">Time</div>
                <div className="font-semibold">{selectedSlot.start_time}</div>
              </div>
              <div>
                <div className="text-gray-600">Price</div>
                <div className="font-bold text-lg">${selectedService.base_price}</div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-600">Client</div>
                <div className="font-semibold">{clientInfo.name}</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-600 mb-4 text-center">
            ✓ A parent/guardian will be present or reachable
          </p>

          <button
            onClick={() => handleBooking()}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition mb-2"
          >
            Confirm booking ✓
          </button>

          <button
            onClick={() => setStep(2)}
            className="w-full text-gray-600 font-semibold py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  )

  async function handleBooking() {
    if (!selectedService || !selectedSlot) return

    try {
      const { error } = await supabase.from('bookings').insert([
        {
          operator_id: operatorId,
          client_name: clientInfo.name,
          client_phone: clientInfo.phone,
          client_email: clientInfo.email || null,
          client_address: clientInfo.address,
          service_id: selectedService.id,
          slot_id: selectedSlot.id,
          date: selectedSlot.date,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          total_price: selectedService.base_price,
          payment_method: 'cash',
          payment_timing: 'after',
          notes: clientInfo.notes || null,
        },
      ])

      if (error) {
        console.error('Booking failed:', error)
        return
      }

      // Mark slot as booked
      await supabase
        .from('slots')
        .update({ booked: true })
        .eq('id', selectedSlot.id)

      // TODO: Send SMS to operator and client
      // TODO: Show success message

      alert('Booking confirmed! You will receive a confirmation SMS.')
    } catch (error) {
      console.error('Booking error:', error)
      alert('Failed to create booking. Please try again.')
    }
  }
}
