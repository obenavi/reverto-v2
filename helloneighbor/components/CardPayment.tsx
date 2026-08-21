'use client';

import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { Notice } from '@/components/ui';
import { formatPrice } from '@/lib/format';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

/**
 * Places the authorization hold. The intent was created with
 * capture_method: 'manual', so confirming here authorizes the card without
 * charging it — the operator captures when they mark the job done.
 */
function CardForm({
  amountCents,
  onSuccess,
  onError,
}: {
  amountCents: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });
    setBusy(false);

    if (error) {
      onError(error.message ?? 'That card was declined.');
      return;
    }
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <PaymentElement />
      <Notice tone="info">
        We hold {formatPrice(amountCents)} now and only charge it once the job is done.
      </Notice>
      <button className="btn-primary w-full" disabled={!stripe || busy}>
        {busy ? 'Confirming…' : `Hold ${formatPrice(amountCents)}`}
      </button>
    </form>
  );
}

export default function CardPayment(props: {
  clientSecret: string;
  amountCents: number;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  if (!stripePromise) {
    return (
      <Notice tone="error">
        Card payments aren&apos;t set up — NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing.
      </Notice>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: props.clientSecret,
        appearance: { variables: { colorPrimary: '#185FA5', borderRadius: '8px' } },
      }}
    >
      <CardForm
        amountCents={props.amountCents}
        onSuccess={props.onSuccess}
        onError={props.onError}
      />
    </Elements>
  );
}
