'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Subscriber, Booking, Ping, Service, Slot } from '@/lib/types'

type DashboardTab = 'bookings' | 'schedule' | 'pings' | 'services' | 'profile' | 'mylink' | 'gallery' | 'reviews' | 'history' | 'onboarding'

export default function DashboardPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<DashboardTab>('bookings')
  const [operator, setOperator] = useState<Subscriber | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pings, setPings] = useState<Ping[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const operatorId = localStorage.getItem('operatorId')
    if (!operatorId) {
      router.push('/login')
      return
    }

    loadDashboardData(operatorId)
  }, [router])

  async function loadDashboardData(operatorId: string) {
    try {
      // Load operator
      const { data: op } = await supabase
        .from('subscribers')
        .select('*')
        .eq('id', operatorId)
        .single()

      if (op) setOperator(op)

      // Load bookings
      const { data: bk } = await supabase
        .from('bookings')
        .select('*')
        .eq('operator_id', operatorId)
        .order('date', { ascending: false })

      if (bk) setBookings(bk)

      // Load pings
      const { data: pg } = await supabase
        .from('pings')
        .select('*')
        .eq('operator_id', operatorId)
        .eq('status', 'new')

      if (pg) setPings(pg)

      // Load services
      const { data: svc } = await supabase
        .from('services')
        .select('*')
        .eq('operator_id', operatorId)

      if (svc) setServices(svc)

      // Load slots
      const { data: sl } = await supabase
        .from('slots')
        .select('*')
        .eq('operator_id', operatorId)

      if (sl) setSlots(sl)

      setLoading(false)
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setLoading(false)
    }
  }

  if (loading || !operator) {
    return (
      <div className="container-max flex items-center justify-center min-h-screen">
        Loading dashboard...
      </div>
    )
  }

  return (
    <div className="container-max pb-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h1 className="text-2xl font-bold">My Business</h1>
          <p className="text-sm text-gray-600">{operator.area}</p>
        </div>
        <button
          onClick={() => {
            localStorage.removeItem('operatorId')
            router.push('/')
          }}
          className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200 transition"
        >
          Log out
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{bookings.length}</div>
          <div className="text-xs text-gray-600 mt-1">Bookings</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{slots.filter((s) => !s.booked).length}</div>
          <div className="text-xs text-gray-600 mt-1">Open slots</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{pings.length}</div>
          <div className="text-xs text-gray-600 mt-1">Pings</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-4">
        {[
          { id: 'bookings', label: '📋 Bookings' },
          { id: 'schedule', label: '📅 Schedule' },
          { id: 'pings', label: '🙋 Pings' },
          { id: 'services', label: '🔧 Services' },
          { id: 'profile', label: '👤 Profile' },
          { id: 'mylink', label: '🔗 My Link' },
          { id: 'gallery', label: '📸 Gallery' },
          { id: 'reviews', label: '⭐ Reviews' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as DashboardTab)}
            className={`text-sm font-medium px-3 py-2 whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-lg font-bold mb-4">My bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-gray-500 text-sm">No bookings yet. Share your link to get started!</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold">{booking.client_name}</h3>
                        <p className="text-xs text-gray-600">{booking.date} at {booking.start_time}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">${booking.total_price}</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">
                          {booking.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">📍 {booking.client_address}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div>
            <h2 className="text-lg font-bold mb-4">My schedule</h2>
            <div className="bg-white rounded-lg p-4 border border-gray-200 mb-4">
              <p className="text-sm text-gray-600 mb-3">Add a new time slot</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start</label>
                    <input type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End</label>
                    <input type="time" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                </div>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">
                  + Add slot
                </button>
              </div>
            </div>

            {slots.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Your slots</h3>
                <div className="space-y-2">
                  {slots.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-semibold text-sm">{slot.date}</div>
                        <div className="text-xs text-gray-600">
                          {slot.start_time} - {slot.end_time}
                        </div>
                      </div>
                      <div className="text-right">
                        {slot.booked && <span className="text-xs font-bold text-red-600">Booked</span>}
                        {slot.urgent && <span className="text-xs font-bold text-amber-600">⚡ Urgent</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pings Tab */}
        {activeTab === 'pings' && (
          <div>
            <h2 className="text-lg font-bold mb-4">🙋 Availability pings</h2>
            <p className="text-xs text-gray-600 mb-4">Neighbors asking if you're free — reply quickly!</p>
            {pings.length === 0 ? (
              <p className="text-gray-500 text-sm">No pings yet. Make sure your link is shared!</p>
            ) : (
              <div className="space-y-3">
                {pings.map((ping) => (
                  <div key={ping.id} className="bg-green-50 rounded-lg p-4 border-l-4 border-green-600">
                    <div className="font-semibold text-sm">{ping.client_name}</div>
                    <p className="text-xs text-gray-600 mt-1">
                      📞 {ping.client_phone} • Wants: {ping.when_available}
                    </p>
                    {ping.notes && <p className="text-xs text-gray-600 mt-2">📝 {ping.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div>
            <h2 className="text-lg font-bold mb-4">My services & pricing</h2>
            <p className="text-xs text-gray-600 mb-4">Turn services on/off and set your own prices.</p>
            <div className="space-y-3">
              {services.map((service) => (
                <div key={service.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold">{service.name}</div>
                      <div className="text-sm text-gray-600 mt-1">${service.base_price}</div>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={service.active}
                        onChange={async (e) => {
                          await supabase
                            .from('services')
                            .update({ active: e.target.checked })
                            .eq('id', service.id)

                          // Reload
                          location.reload()
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{service.active ? 'Active' : 'Inactive'}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div>
            <h2 className="text-lg font-bold mb-4">My profile</h2>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Display name</label>
                  <input
                    type="text"
                    defaultValue={operator.name}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">About me</label>
                  <textarea
                    defaultValue={operator.bio}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">
                    Payment methods
                  </label>
                  <div className="space-y-2">
                    {['Cash', 'Venmo', 'Cash App', 'Zelle'].map((method) => (
                      <label key={method} className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm">{method}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition">
                  Save profile
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Link Tab */}
        {activeTab === 'mylink' && (
          <div>
            <h2 className="text-lg font-bold mb-4">🔗 My booking link & QR code</h2>
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <p className="text-sm text-gray-600 mb-4">
                Share this link with your neighbors:
              </p>
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/b/${operator.id}`}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50"
                />
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
                  Copy
                </button>
              </div>

              <div className="text-center py-8 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-4">QR code for your flyer</p>
                <div className="inline-block w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-xs text-gray-500">QR code here</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div>
            <h2 className="text-lg font-bold mb-4">📸 Work gallery</h2>
            <p className="text-xs text-gray-600 mb-4">
              Show neighbors what your work looks like. Before/after photos build trust.
            </p>
            <button className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
              <div className="text-2xl mb-2">📷</div>
              <p className="text-sm font-semibold">Click to add photos</p>
              <p className="text-xs text-gray-500 mt-1">Add up to 18 photos</p>
            </button>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div>
            <h2 className="text-lg font-bold mb-4">⭐ Reviews from neighbors</h2>
            <p className="text-sm text-gray-600">No reviews yet. Get your first booking to earn reviews!</p>
          </div>
        )}
      </div>
    </div>
  )
}
