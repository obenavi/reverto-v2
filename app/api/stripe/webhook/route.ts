import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ''
    )
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        // Payment succeeded (already captured or not using manual capture)
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        if (paymentIntent.metadata.bookingId) {
          await supabase
            .from('bookings')
            .update({
              payment_status: 'captured',
            })
            .eq('id', paymentIntent.metadata.bookingId)
        }
        break

      case 'charge.captured':
        // Manual capture successful
        const charge = event.data.object as Stripe.Charge
        if (charge.payment_intent && typeof charge.payment_intent === 'string') {
          // Update booking with captured status
          const intent = await stripe.paymentIntents.retrieve(charge.payment_intent)
          if (intent.metadata.bookingId) {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'captured',
              })
              .eq('id', intent.metadata.bookingId)
          }
        }
        break

      case 'charge.refunded':
        // Payment refunded
        const refundedCharge = event.data.object as Stripe.Charge
        if (refundedCharge.payment_intent && typeof refundedCharge.payment_intent === 'string') {
          const intent = await stripe.paymentIntents.retrieve(refundedCharge.payment_intent)
          if (intent.metadata.bookingId) {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'failed',
              })
              .eq('id', intent.metadata.bookingId)
          }
        }
        break

      case 'payment_intent.payment_failed':
        // Payment failed
        const failedIntent = event.data.object as Stripe.PaymentIntent
        if (failedIntent.metadata.bookingId) {
          await supabase
            .from('bookings')
            .update({
              payment_status: 'failed',
            })
            .eq('id', failedIntent.metadata.bookingId)
        }
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
