// Operator/Subscriber
export type Subscriber = {
  id: string
  name: string
  phone: string
  area: string
  age: number
  bio: string
  status: 'pending' | 'active' | 'suspended'
  joinedDate: string
  activatedDate: string | null
  paidMonths: number
  monthlyFee: number
  plan: 'starter' | 'pro'
  notes: string
  referredBy: string | null
  freeMonths: number
  boostActive: boolean
  setupComplete: boolean
  createdAt: string
  updatedAt: string
}

// Operator Profile
export type OperatorProfile = {
  id: string
  operatorId: string
  photo: string
  displayName: string
  age: number
  area: string
  bio: string
  parentPhone: string
  instagram: string | null
  tiktok: string | null
  payMethods: string[]
  venmoHandle: string | null
  cashappHandle: string | null
  createdAt: string
  updatedAt: string
}

// Service
export type Service = {
  id: string
  operatorId: string
  name: string
  icon: string
  description: string
  basePrice: number
  active: boolean
  duration: string
  tools: string
  clientProvides: string
  requirements: string
  upgrades: Upgrade[]
  subjects?: string[]
  createdAt: string
  updatedAt: string
}

export type Upgrade = {
  label: string
  price: number
}

// Availability Slot
export type Slot = {
  id: string
  operatorId: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  urgent: boolean // last-minute (today)
  booked: boolean
  createdAt: string
  updatedAt: string
}

// Booking
export type Booking = {
  id: string
  operatorId: string
  clientName: string
  clientPhone: string
  clientEmail: string | null
  clientAddress: string
  serviceId: string
  slotId: string
  date: string
  startTime: string
  endTime: string
  selectedUpgrades: Upgrade[]
  notes: string | null
  totalPrice: number
  paymentMethod: 'cash' | 'venmo' | 'cashapp' | 'zelle' | 'stripe'
  paymentTiming: 'before' | 'after' // before: upfront, after: on completion
  paymentStatus: 'pending' | 'captured' | 'released' | 'disputed' | 'failed'
  stripePaymentIntentId?: string
  status: 'confirmed' | 'completed' | 'cancelled'
  clientFavorited: boolean
  createdAt: string
  updatedAt: string
}

// Ping (Availability Request)
export type Ping = {
  id: string
  operatorId: string
  clientName: string
  clientPhone: string
  serviceId: string
  when: string // e.g., "this Saturday morning"
  notes: string | null
  status: 'new' | 'replied' | 'booked' | 'declined'
  repliedAt: string | null
  createdAt: string
}

// Review
export type Review = {
  id: string
  operatorId: string
  bookingId: string
  rating: number // 1-5
  publicText: string
  reviewerName: string
  photoUrl: string | null
  isPublic: boolean
  createdAt: string
}

// Dispute
export type Dispute = {
  id: string
  bookingId: string
  operatorId: string
  clientId: string // not stored, derived from booking
  reason: string // no_show, incomplete, damage, safety, overcharged, other
  details: string
  photoUrls: string[]
  status: 'open' | 'resolved' | 'refunded'
  resolution: string | null
  createdAt: string
  updatedAt: string
}

// Gallery Photo
export type GalleryPhoto = {
  id: string
  operatorId: string
  photoUrl: string
  caption: string | null
  createdAt: string
}

// Referral
export type Referral = {
  id: string
  referrerCode: string
  referrerId: string
  referredId: string
  status: 'pending' | 'completed'
  createdAt: string
  completedAt: string | null
}

// Boost
export type Boost = {
  id: string
  operatorId: string
  daysCount: number // 7, 14, or 30
  price: number
  startDate: string
  endDate: string
  status: 'active' | 'expired'
  createdAt: string
}
