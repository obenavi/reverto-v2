import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { currentOperatorId, isAdmin } from '@/lib/session';
import { readConversationToken } from '@/lib/conversations';
import { clientIp, enforceRateLimit } from '@/lib/ratelimit';
import { REPORT_REASONS, isUrgent } from '@/lib/reports';
import { sendSms } from '@/lib/sms';
import type { ReportReason, ReportSubject } from '@/lib/types';

const REASONS = new Set(REPORT_REASONS.map((r) => r.value));
const SUBJECTS = new Set<ReportSubject>([
  'subscriber',
  'message',
  'booking',
  'conversation',
  'service',
]);

/**
 * POST /api/reports — anyone involved can report.
 *
 * An operator is identified by their session. A neighbor has no account, so
 * they report from inside a conversation using its signed token, which also
 * tells us who they are and pins the report to a real interaction. That means
 * a report always comes from a party to the thing being reported.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limited = await enforceRateLimit('ping', [ip]);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });

  const reason = String(body.reason ?? '') as ReportReason;
  const subjectType = String(body.subject_type ?? '') as ReportSubject;
  const subjectId = String(body.subject_id ?? '');
  const details = body.details ? String(body.details).trim().slice(0, 2000) : null;

  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: 'Pick a reason.' }, { status: 400 });
  }
  if (!SUBJECTS.has(subjectType) || !subjectId) {
    return NextResponse.json({ error: 'Missing what you are reporting.' }, { status: 400 });
  }

  // Resolve the caller from a credential — never from the body — and refuse
  // before doing any work if there isn't one.
  const conversationId = readConversationToken(body.token);
  const operatorId = currentOperatorId();
  const admin = isAdmin();

  if (!conversationId && !operatorId && !admin) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  const db = supabaseAdmin();

  let reporterType: 'operator' | 'neighbor' | 'admin';
  let reporterId: string | null = null;
  let reporterPhone: string | null = null;

  if (conversationId) {
    const { data: conversation } = await db
      .from('conversations')
      .select('client_phone')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
    }
    reporterType = 'neighbor';
    reporterPhone = conversation.client_phone;
  } else if (operatorId) {
    reporterType = 'operator';
    reporterId = operatorId;
  } else {
    reporterType = 'admin';
  }

  const { data, error } = await db
    .from('reports')
    .insert({
      reporter_type: reporterType,
      reporter_id: reporterId,
      reporter_phone: reporterPhone,
      subject_type: subjectType,
      subject_id: subjectId,
      reason,
      details,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[reports:create]', error);
    return NextResponse.json({ error: 'Could not send that report.' }, { status: 500 });
  }

  // Safety-critical reports page the admin rather than waiting to be noticed.
  if (isUrgent(reason)) {
    const alertTo = process.env.SAFETY_ALERT_PHONE;
    if (alertTo) {
      await sendSms(
        alertTo,
        `URGENT HelloNeighbor report (${reason}) on ${subjectType} ${subjectId.slice(0, 8)}. Review now: ${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/admin`
      );
    }
  }

  return NextResponse.json({ ok: true, id: data.id, urgent: isUrgent(reason) }, { status: 201 });
}
