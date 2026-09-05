/**
 * Reminder emails.
 *
 * Deliberately unbranded: these read as a short note a person would send, not
 * as a notification from a scheduling product. No header banner, no gradient,
 * no urgency colour, no button, no "automated email" footer — plain sentences
 * and plain links, sent as text with a minimal HTML mirror.
 */

import type { BookingEmailData } from '../types';
import { createEmailFormatters } from '../formatters';

type ReminderType = 'reminder_24h' | 'reminder_1h' | 'reminder_30m';

/**
 * "Europe/London" → "London time". Attendees may be in another timezone, so
 * the time is always qualified rather than left ambiguous.
 */
function timezoneLabel(timezone?: string): string {
	if (!timezone || !timezone.includes('/')) {
		return '';
	}
	const city = timezone.split('/').pop()?.replace(/_/g, ' ');
	return city ? ` ${city} time` : '';
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** First name only — "Hi Adwaith" reads human, "Hi Adwaith Krishna" does not. */
function firstName(fullName: string): string {
	return fullName.trim().split(/\s+/)[0] || fullName;
}

interface ReminderCopy {
	subject: string;
	/** Paragraphs, in order. Links are bare URLs. */
	paragraphs: string[];
	signOff: string;
}

function buildCopy(data: BookingEmailData, reminderType: ReminderType): ReminderCopy {
	const { formatTime } = createEmailFormatters(data.timeFormat, data.timezone);
	const dayName = new Intl.DateTimeFormat('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		timeZone: data.timezone
	}).format(data.startTime);

	const time = new Intl.DateTimeFormat('en-GB', {
		hour: 'numeric',
		minute: '2-digit',
		hour12: data.timeFormat !== '24h',
		timeZone: data.timezone
	})
		.format(data.startTime)
		.replace(/\s?([ap]m)/i, (_, suffix) => suffix.toLowerCase());

	const zone = timezoneLabel(data.timezone);
	const name = firstName(data.attendeeName);
	const signature = data.senderName || data.hostName;
	const rescheduleUrl = `${data.appUrl}/reschedule/${data.bookingId}`;

	const paragraphs: string[] = [`Hi ${name},`];

	if (reminderType === 'reminder_24h') {
		paragraphs.push(
			`Just a quick note that we're speaking tomorrow, ${dayName}, at ${time}${zone}.`
		);
		if (data.meetingUrl) {
			paragraphs.push(`Here's the link for when you're ready:\n${data.meetingUrl}`);
		}
		if (data.customMessage) {
			paragraphs.push(data.customMessage);
		}
		paragraphs.push(
			`If something's come up, you can pick another time here:\n${rescheduleUrl}\n\nOr just reply to this email and we'll sort it out.`
		);
		return {
			subject: `Speaking tomorrow at ${time}`,
			paragraphs,
			signOff: `Speak tomorrow,\n${signature}`
		};
	}

	if (reminderType === 'reminder_1h') {
		paragraphs.push(`We're on in an hour, at ${time}${zone}.`);
		if (data.meetingUrl) {
			paragraphs.push(`Here's the link:\n${data.meetingUrl}`);
		}
		if (data.customMessage) {
			paragraphs.push(data.customMessage);
		}
		paragraphs.push(`If now no longer works, just reply and we'll find another time.`);
		return {
			subject: `We're on in an hour`,
			paragraphs,
			signOff: `See you shortly,\n${signature}`
		};
	}

	paragraphs.push(`We're starting in about half an hour, at ${time}${zone}.`);
	if (data.meetingUrl) {
		paragraphs.push(`Here's the link:\n${data.meetingUrl}`);
	}
	if (data.customMessage) {
		paragraphs.push(data.customMessage);
	}
	return {
		subject: `Starting in half an hour`,
		paragraphs,
		signOff: `See you shortly,\n${signature}`
	};
}

/**
 * Plain-text body — the primary version. Reads as a typed note.
 */
export function generateReminderText(data: BookingEmailData, reminderType: ReminderType): string {
	const copy = buildCopy(data, reminderType);
	return [...copy.paragraphs, copy.signOff].join('\n\n');
}

/**
 * Minimal HTML mirror for clients that prefer HTML. Same words, same order,
 * default typography, links as links. Nothing that looks generated.
 */
export function generateReminderEmail(data: BookingEmailData, reminderType: ReminderType): string {
	const copy = buildCopy(data, reminderType);

	const toHtml = (block: string): string =>
		escapeHtml(block)
			.split('\n')
			.map((line) =>
				/^https?:\/\//.test(line.trim())
					? `<a href="${line.trim()}" style="color: #1a56db;">${line.trim()}</a>`
					: line
			)
			.join('<br>');

	const body = [...copy.paragraphs, copy.signOff]
		.map((block) => `<p style="margin: 0 0 16px;">${toHtml(block)}</p>`)
		.join('\n');

	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 24px; background-color: #ffffff;">
<div style="max-width: 560px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 24px; color: #111827;">
${body}
</div>
</body>
</html>`;
}

/**
 * Subject lines, matching the tone of the body.
 */
export function getDefaultReminderSubject(
	data: BookingEmailData,
	reminderType: ReminderType
): string {
	return buildCopy(data, reminderType).subject;
}
