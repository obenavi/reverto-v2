/**
 * Reaching an adult when something is wrong.
 *
 * ## The order, and why it is that order
 *
 * Guardian first, then emergency contacts by priority, then us. A guardian is
 * the person with actual authority over the young person and the one who can
 * drive to the address; an emergency contact is the fallback for the evening
 * the guardian's phone is dead. We are last because we can do the least — we
 * are three states away and can only make phone calls.
 *
 * Everyone in the chain is contacted, not just the first who answers. An
 * escalation is not a phone tree where success stops the process: if a young
 * person pressed a panic button, their aunt finding out ten minutes later
 * costs nothing and might matter.
 *
 * ## What this is not
 *
 * Not an emergency service, and the interface says so before it says anything
 * else. This sends text messages. It does not dispatch anyone, and the General
 * Terms are explicit that we undertake no duty to rescue. The button that
 * fires this sits underneath a line telling the user to call 911 first.
 */
import { supabaseAdmin } from './supabase';
import { sendSms } from './sms';
import {
  escalationMessage,
  type EscalationTarget,
  type EscalationTrigger,
} from './contacts';

// The pure constants live in ./contacts so client components can import them
// without pulling Twilio into the browser bundle.
export {
  MAX_EMERGENCY_CONTACTS,
  CONTACT_RELATIONSHIPS,
  escalationMessage,
} from './contacts';
export type { EscalationTrigger, EscalationTarget } from './contacts';

/**
 * Everyone who should hear about this, in the order to try them.
 *
 * Returns targets rather than sending, so the order is testable without a
 * network and so a caller can see who would be reached before reaching them.
 */
export async function escalationTargets(subscriberId: string): Promise<EscalationTarget[]> {
  const db = supabaseAdmin();
  const targets: EscalationTarget[] = [];

  const [{ data: links }, { data: contacts }] = await Promise.all([
    db
      .from('parent_links')
      .select('parents (first_name, last_name, phone)')
      .eq('subscriber_id', subscriberId)
      .eq('status', 'active'),
    db
      .from('emergency_contacts')
      .select('name, phone, priority')
      .eq('subscriber_id', subscriberId)
      .order('priority'),
  ]);

  for (const link of links ?? []) {
    const parent = link.parents as unknown as {
      first_name: string;
      last_name: string;
      phone: string | null;
    } | null;
    if (parent?.phone) {
      targets.push({
        contacted: 'guardian',
        name: `${parent.first_name} ${parent.last_name}`,
        phone: parent.phone,
      });
    }
  }

  for (const contact of contacts ?? []) {
    // Skip a number already reached as the guardian — one person, one text.
    if (targets.some((t) => t.phone === contact.phone)) continue;
    targets.push({
      contacted: 'emergency_contact',
      name: contact.name,
      phone: contact.phone,
    });
  }

  const adminPhone = process.env.SAFETY_ALERT_PHONE;
  if (adminPhone) {
    targets.push({ contacted: 'admin', name: 'HelloNeighbor', phone: adminPhone });
  }

  return targets;
}

/**
 * Contacts everyone and records who was actually reached.
 *
 * Failures are recorded rather than thrown: one unreachable number must not
 * stop the rest of the chain, and "we could not deliver to the mother" is
 * exactly the thing somebody will need to know afterwards.
 */
export async function escalate(args: {
  subscriberId: string;
  trigger: EscalationTrigger;
  youngPersonName: string;
  bookingId?: string | null;
  reportId?: string | null;
  where?: string | null;
  when?: string | null;
}): Promise<{ reached: number; attempted: number }> {
  const targets = await escalationTargets(args.subscriberId);
  const message = escalationMessage({
    trigger: args.trigger,
    youngPersonName: args.youngPersonName,
    where: args.where ?? null,
    when: args.when ?? null,
  });

  const db = supabaseAdmin();
  const rows: Record<string, unknown>[] = [];
  let reached = 0;

  for (const target of targets) {
    let delivered = false;
    let detail: string | null = null;
    try {
      const result = await sendSms(target.phone, message);
      delivered = result?.sent !== false;
      if (delivered) reached += 1;
    } catch (err) {
      detail = err instanceof Error ? err.message : 'send failed';
      console.error('[escalation] could not reach', target.contacted, err);
    }

    rows.push({
      subscriber_id: args.subscriberId,
      booking_id: args.bookingId ?? null,
      report_id: args.reportId ?? null,
      trigger: args.trigger,
      contacted: target.contacted,
      contact_name: target.name,
      contact_phone: target.phone,
      channel: 'sms',
      delivered,
      detail,
    });
  }

  if (rows.length > 0) {
    const { error } = await db.from('escalations').insert(rows);
    if (error) console.error('[escalation] could not record', error);
  }

  return { reached, attempted: targets.length };
}
