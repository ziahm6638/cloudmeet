/**
 * Tell the CRM about a booking it did not make.
 *
 * A prospect who takes the link away and books on Tuesday is invisible to the
 * CRM otherwise, and half the flow works that way: the rep books live when he
 * can and sends the link when he cannot. Cancellations matter for the same
 * reason — one prospect booked three times and cancelled twice, and without
 * this the pipeline would show three live demos for one man.
 *
 * Never throws. The booking is already made and confirmed; failing to tell the
 * CRM must not fail the request the attendee is waiting on.
 */
export interface CrmEnv {
	CRM_WEBHOOK_URL?: string;
	CRM_API_SECRET?: string;
}

export type BookingEvent = {
	type: 'created' | 'rescheduled' | 'cancelled';
	bookingId: string;
	start: string;
	end?: string;
	timezone?: string;
	joinUrl?: string | null;
	attendeeName?: string | null;
	attendeeCompany?: string | null;
	attendeeEmail?: string | null;
	crm?: { companyId?: string; contactId?: string; dealId?: string };
};

export async function notifyCrm(env: CrmEnv, event: BookingEvent): Promise<void> {
	const url = env.CRM_WEBHOOK_URL;
	const secret = env.CRM_API_SECRET;
	if (!url || !secret) return;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${secret}`
			},
			body: JSON.stringify(event),
			signal: AbortSignal.timeout(8000)
		});

		if (!response.ok) {
			console.error(`CRM webhook refused (${response.status}) for ${event.bookingId}`);
		}
	} catch (err) {
		console.error('CRM webhook failed (booking stands):', err);
	}
}
