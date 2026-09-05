/**
 * Nobody works at an empty house.
 *
 * Every booking is one of exactly two arrangements:
 *
 *   at_provider     the job happens at the provider's own place. They are
 *                   home by definition; the customer comes to them.
 *   customer_home   the job happens at the customer's place, and the customer
 *                   or another responsible adult is there for the whole of it.
 *
 * There is deliberately no third option — no "leave the gate unlocked", no
 * "the key is under the mat". A booking that cannot be one of these two is a
 * booking this app should not take.
 *
 * ## Why it is not conditioned on the provider's age
 *
 * The terms used to require a customer's presence only when the provider was
 * under 18, and that was the wrong line. The risk runs both ways: a young
 * person alone inside a stranger's house is exposed, and so is a householder
 * who let a stranger in and went out. Neither stops mattering the day somebody
 * turns eighteen, and a rule with an exemption is a rule people argue about at
 * the door. This one has none.
 *
 * ## Why it is recorded per booking
 *
 * A service is listed as at_provider or at_customer, but the arrangement is
 * agreed per job — and what matters later is what the customer confirmed for
 * THIS booking, not what the listing said at the time.
 */

export type Presence = 'at_provider' | 'customer_home';
export type ServiceLocation = 'at_provider' | 'at_customer';

/** The only arrangement a given service can have. */
export function presenceFor(location: ServiceLocation): Presence {
  return location === 'at_provider' ? 'at_provider' : 'customer_home';
}

/** Whether the customer has to actively confirm they will be there. */
export function needsCustomerPresent(location: ServiceLocation): boolean {
  return presenceFor(location) === 'customer_home';
}

export type PresenceCheck =
  | { ok: true; presence: Presence }
  | { ok: false; message: string };

/**
 * Fails closed: an at_customer booking without the confirmation is refused.
 *
 * The tempting alternative is to default it to true and let the consent
 * checkbox carry it. That makes the most important rule in the app the one
 * nobody actively answered.
 */
export function checkPresence(args: {
  location: ServiceLocation;
  /** What the customer ticked. Ignored for a job at the provider's place. */
  confirmed: boolean;
  providerName: string;
}): PresenceCheck {
  if (args.location === 'at_provider') return { ok: true, presence: 'at_provider' };

  if (!args.confirmed) {
    return {
      ok: false,
      message: `Somebody has to be home for the whole booking. ${args.providerName} does not work at an empty house, and there is no way to book one.`,
    };
  }

  return { ok: true, presence: 'customer_home' };
}

/** The line shown on the booking page, before anybody fills anything in. */
export function presenceNotice(args: {
  location: ServiceLocation;
  providerName: string;
}): string {
  return args.location === 'at_provider'
    ? `This one happens at ${args.providerName}'s place — you go to them, and they will be there.`
    : `You need to be home for the whole booking. ${args.providerName} does not work at an empty house.`;
}

/** How the arrangement reads afterwards, on a booking somebody is looking back at. */
export function presenceLabel(presence: Presence): string {
  return presence === 'at_provider'
    ? 'At the provider’s place'
    : 'At your place, with you there';
}
