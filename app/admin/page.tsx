'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Subscriber, Booking, Dispute } from '@/lib/types'

type AdminTab = 'subscribers' | 'bookings' | 'disputes' | 'referrals' | 'boosts' | 'settings'

export default function AdminPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<AdminTab>('subscribers')
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check admin password
    const pw = prompt('Enter admin password:')
    if (pw !== process.env.NEXT_PUBLIC_ADMIN_PASSWORD && pw !== 'demo123') {
      router.push('/')
      return
    }

    setIsAdmin(true)
    loadAdminData()
  }, [router])

  async function loadAdminData() {
    try {
      // Load all subscribers
      const { data: subs } = await supabase
        .from('subscribers')
        .select('*')
        .order('created_at', { ascending: false })

      if (subs) setSubscribers(subs)

      // Load all bookings
      const { data: bks } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (bks) setBookings(bks)

      // Load disputes
      const { data: disp } = await supabase
        .from('disputes')
        .select('*')
        .eq('status', 'open')

      if (disp) setDisputes(disp)

      setLoading(false)
    } catch (error) {
      console.error('Error loading admin data:', error)
      setLoading(false)
    }
  }

  if (!isAdmin || loading) {
    return (
      <div className="container-max flex items-center justify-center min-h-screen">
        {loading ? 'Loading...' : 'Unauthorized'}
      </div>
    )
  }

  const stats = {
    totalSubs: subscribers.length,
    activeSubs: subscribers.filter((s) => s.status === 'active').length,
    pendingSubs: subscribers.filter((s) => s.status === 'pending').length,
    totalBookings: bookings.length,
    openDisputes: disputes.length,
  }

  return (
    <div className="container-max pb-12">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 mt-4">
        <h1 className="text-2xl font-bold">⚙️ Admin Dashboard</h1>
        <button
          onClick={() => {
            sessionStorage.removeItem('adminAuth')
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
          <div className="text-2xl font-bold text-blue-600">{stats.totalSubs}</div>
          <div className="text-xs text-gray-600 mt-1">Subscribers</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.pendingSubs}</div>
          <div className="text-xs text-gray-600 mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
          <div className="text-2xl font-bold text-red-600">{stats.openDisputes}</div>
          <div className="text-xs text-gray-600 mt-1">Disputes</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-4">
        {[
          { id: 'subscribers', label: '👫 Subscribers' },
          { id: 'bookings', label: '📋 Bookings' },
          { id: 'disputes', label: '⚠️ Disputes' },
          { id: 'referrals', label: '🎁 Referrals' },
          { id: 'boosts', label: '🚀 Boosts' },
          { id: 'settings', label: '⚙️ Settings' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
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
        {/* Subscribers Tab */}
        {activeTab === 'subscribers' && (
          <div>
            <h2 className="text-lg font-bold mb-4">Subscriber management</h2>

            {/* Pending Section */}
            <div className="mb-8">
              <h3 className="font-semibold mb-3 text-amber-600">
                ⏳ Pending Approval ({stats.pendingSubs})
              </h3>
              <div className="space-y-2">
                {subscribers
                  .filter((s) => s.status === 'pending')
                  .map((sub) => (
                    <div key={sub.id} className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold">{sub.name}</div>
                          <p className="text-sm text-gray-600 mt-1">
                            📞 {sub.phone} • 📍 {sub.area}
                          </p>
                          {sub.bio && <p className="text-sm text-gray-600 mt-1">📝 {sub.bio}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await supabase
                                .from('subscribers')
                                .update({
                                  status: 'active',
                                  activated_date: new Date().toISOString(),
                                })
                                .eq('id', sub.id)

                              loadAdminData()
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm font-semibold hover:bg-green-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={async () => {
                              await supabase
                                .from('subscribers')
                                .delete()
                                .eq('id', sub.id)

                              loadAdminData()
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm font-semibold hover:bg-red-700 transition"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Active Section */}
            <div>
              <h3 className="font-semibold mb-3">✅ Active ({stats.activeSubs})</h3>
              <div className="space-y-2">
                {subscribers
                  .filter((s) => s.status === 'active')
                  .slice(0, 10)
                  .map((sub) => (
                    <div key={sub.id} className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-sm">{sub.name}</div>
                        <p className="text-xs text-gray-600">{sub.phone} • {sub.area}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-green-600">
                          Since {new Date(sub.activated_date || '').toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === 'bookings' && (
          <div>
            <h2 className="text-lg font-bold mb-4">All bookings</h2>
            <div className="space-y-2">
              {bookings.slice(0, 20).map((booking) => (
                <div key={booking.id} className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{booking.client_name}</div>
                      <p className="text-sm text-gray-600 mt-1">
                        📅 {booking.date} • 💰 ${booking.total_price}
                      </p>
                      <p className="text-xs text-gray-600">Payment: {booking.payment_method}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      booking.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disputes Tab */}
        {activeTab === 'disputes' && (
          <div>
            <h2 className="text-lg font-bold mb-4">
              Open Disputes ({stats.openDisputes})
            </h2>
            {disputes.length === 0 ? (
              <p className="text-gray-500 text-sm">No open disputes.</p>
            ) : (
              <div className="space-y-3">
                {disputes.map((dispute) => (
                  <div key={dispute.id} className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">Dispute: {dispute.reason}</h3>
                      <span className="text-xs font-bold text-red-600">⚠️ OPEN</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{dispute.details}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          await supabase
                            .from('disputes')
                            .update({ status: 'resolved' })
                            .eq('id', dispute.id)

                          loadAdminData()
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                      >
                        Resolve
                      </button>
                      <button
                        onClick={async () => {
                          await supabase
                            .from('disputes')
                            .update({ status: 'refunded' })
                            .eq('id', dispute.id)

                          loadAdminData()
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                      >
                        Refund
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Other Tabs */}
        {['referrals', 'boosts', 'settings'].includes(activeTab) && (
          <div>
            <p className="text-gray-500 text-sm">Coming soon...</p>
          </div>
        )}
      </div>
    </div>
  )
}
