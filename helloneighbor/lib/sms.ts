import twilio from 'twilio';

type SmsResult = { sent: boolean; reason?: string };

/**
 * Sends an SMS through Twilio. When Twilio isn't configured the message is
 * logged instead of throwing, so the rest of a booking still completes in
 * local development.
 */
export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.info(`[sms:unconfigured] to=${to} body=${body}`);
    return { sent: false, reason: 'twilio_not_configured' };
  }

  try {
    await twilio(sid, token).messages.create({ to, from, body });
    return { sent: true };
  } catch (err) {
    console.error('[sms:failed]', err);
    return { sent: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}

export const smsTemplates = {
  otp: (code: string) => `Your HelloNeighbor code is ${code}. It expires in 10 minutes.`,

  newBooking: (clientName: string, serviceTitle: string, when: string) =>
    `New booking from ${clientName} — ${serviceTitle} on ${when}. Open your dashboard to see the details.`,

  bookingConfirmed: (operatorName: string, serviceTitle: string, when: string) =>
    `Booking confirmed! ${operatorName} has you down for ${serviceTitle} on ${when}.`,

  reminder: (serviceTitle: string, when: string) =>
    `Reminder: ${serviceTitle} is coming up on ${when}.`,

  cancelled: (serviceTitle: string, when: string) =>
    `Your ${serviceTitle} booking on ${when} was cancelled.`,

  reviewRequest: (operatorName: string, link: string) =>
    `How did ${operatorName} do? Leave a quick review: ${link}`,

  newPing: (clientName: string) =>
    `${clientName} asked if you're available. Reply from your HelloNeighbor dashboard.`,
};
