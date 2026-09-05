/**
 * CalDAV calendar integration (Nextcloud).
 *
 * Plain fetch + Basic auth against a single shared calendar collection, so it
 * runs on Workers with no dependencies and nothing to revoke but an app
 * password. Mirrors the shape of google-calendar.ts / outlook-calendar.ts:
 * busy times for availability, plus event create/delete for bookings.
 *
 * Busy queries ask the server to expand recurrences (RFC 4791 §9.6.5), so
 * every instance comes back as a concrete UTC DTSTART/DTEND and this module
 * never has to interpret RRULE or VTIMEZONE.
 */

export interface CalDAVConfig {
	/** Collection URL, e.g. https://host/remote.php/dav/calendars/user/team/ */
	calendarUrl: string;
	username: string;
	password: string;
}

export interface CalDAVBusySlot {
	start: string;
	end: string;
}

export interface CalDAVEventInput {
	uid: string;
	title: string;
	description?: string | null;
	location?: string | null;
	startTime: Date;
	endTime: Date;
	organizerEmail?: string | null;
	organizerName?: string | null;
	attendeeEmail?: string | null;
	attendeeName?: string | null;
}

interface CalDAVEnv {
	NEXTCLOUD_URL?: string;
	NEXTCLOUD_USERNAME?: string;
	NEXTCLOUD_APP_PASSWORD?: string;
	NEXTCLOUD_CALENDAR?: string;
}

/**
 * Build config from environment, or null when CalDAV is not configured.
 * Every caller treats null as "feature off" rather than an error.
 */
export function getCalDAVConfig(env: CalDAVEnv | undefined): CalDAVConfig | null {
	if (!env?.NEXTCLOUD_URL || !env.NEXTCLOUD_USERNAME || !env.NEXTCLOUD_APP_PASSWORD) {
		return null;
	}

	const base = env.NEXTCLOUD_URL.replace(/\/+$/, '');
	const calendar = (env.NEXTCLOUD_CALENDAR || 'personal').replace(/^\/+|\/+$/g, '');

	// NEXTCLOUD_CALENDAR may be a bare calendar name or a full DAV path.
	const calendarUrl = calendar.includes('/')
		? `${base}/${calendar}/`
		: `${base}/remote.php/dav/calendars/${env.NEXTCLOUD_USERNAME}/${calendar}/`;

	return {
		calendarUrl,
		username: env.NEXTCLOUD_USERNAME,
		password: env.NEXTCLOUD_APP_PASSWORD
	};
}

function authHeader(config: CalDAVConfig): string {
	// btoa is Latin-1 only; encode UTF-8 credentials byte-wise first.
	const raw = `${config.username}:${config.password}`;
	const bytes = new TextEncoder().encode(raw);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return `Basic ${btoa(binary)}`;
}

/** 20260907T140000Z */
function toICSDate(date: Date): string {
	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function parseICSDate(value: string): Date | null {
	// Expanded responses are UTC (…Z). Tolerate floating local times and dates.
	const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/);
	if (!match) {
		return null;
	}
	const [, y, mo, d, h = '00', mi = '00', s = '00'] = match;
	const date = new Date(
		Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
	);
	return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Unfold ICS continuation lines (a leading space continues the previous line).
 */
function unfold(ics: string): string[] {
	return ics.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function decodeXmlEntities(value: string): string {
	return value
		.replace(/&#13;/g, '\r')
		.replace(/&#10;/g, '\n')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Busy intervals between start and end. Cancelled events and events the
 * organiser marked TRANSPARENT (free) do not block availability.
 */
export async function getCalDAVBusySlots(
	config: CalDAVConfig,
	start: Date,
	end: Date
): Promise<CalDAVBusySlot[]> {
	const body = `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-data>
      <c:expand start="${toICSDate(start)}" end="${toICSDate(end)}"/>
    </c:calendar-data>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${toICSDate(start)}" end="${toICSDate(end)}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`;

	const response = await fetch(config.calendarUrl, {
		method: 'REPORT',
		headers: {
			Authorization: authHeader(config),
			'Content-Type': 'application/xml; charset=utf-8',
			Depth: '1'
		},
		body
	});

	if (!response.ok) {
		throw new Error(`CalDAV busy query failed: ${response.status} ${response.statusText}`);
	}

	const xml = decodeXmlEntities(await response.text());
	const slots: CalDAVBusySlot[] = [];

	// Each VEVENT block in the returned calendar-data payloads.
	for (const block of xml.split('BEGIN:VEVENT').slice(1)) {
		const event = block.split('END:VEVENT')[0];
		const lines = unfold(event);

		let startDate: Date | null = null;
		let endDate: Date | null = null;
		let transparent = false;
		let cancelled = false;

		for (const line of lines) {
			const separator = line.indexOf(':');
			if (separator === -1) {
				continue;
			}
			const name = line.slice(0, separator).split(';')[0].toUpperCase();
			const value = line.slice(separator + 1);

			if (name === 'DTSTART') startDate = parseICSDate(value);
			else if (name === 'DTEND') endDate = parseICSDate(value);
			else if (name === 'TRANSP') transparent = value.trim().toUpperCase() === 'TRANSPARENT';
			else if (name === 'STATUS') cancelled = value.trim().toUpperCase() === 'CANCELLED';
		}

		if (!startDate || !endDate || transparent || cancelled) {
			continue;
		}

		slots.push({ start: startDate.toISOString(), end: endDate.toISOString() });
	}

	return slots;
}

function escapeICSText(value: string): string {
	return value
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Fold lines at 75 octets as required by RFC 5545. */
function foldLine(line: string): string {
	if (line.length <= 75) {
		return line;
	}
	const parts: string[] = [line.slice(0, 75)];
	let rest = line.slice(75);
	while (rest.length > 74) {
		parts.push(` ${rest.slice(0, 74)}`);
		rest = rest.slice(74);
	}
	if (rest.length) {
		parts.push(` ${rest}`);
	}
	return parts.join('\r\n');
}

function buildICS(event: CalDAVEventInput): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//CloudMeet//EN',
		'CALSCALE:GREGORIAN',
		'BEGIN:VEVENT',
		`UID:${event.uid}`,
		`DTSTAMP:${toICSDate(new Date())}`,
		`DTSTART:${toICSDate(event.startTime)}`,
		`DTEND:${toICSDate(event.endTime)}`,
		`SUMMARY:${escapeICSText(event.title)}`
	];

	if (event.description) {
		lines.push(`DESCRIPTION:${escapeICSText(event.description)}`);
	}
	if (event.location) {
		lines.push(`LOCATION:${escapeICSText(event.location)}`);
	}
	if (event.organizerEmail) {
		const name = event.organizerName ? `;CN=${escapeICSText(event.organizerName)}` : '';
		lines.push(`ORGANIZER${name}:mailto:${event.organizerEmail}`);
	}
	if (event.attendeeEmail) {
		const name = event.attendeeName ? `;CN=${escapeICSText(event.attendeeName)}` : '';
		// SCHEDULE-AGENT=CLIENT: the app already emails the attendee, so the
		// server must not send a second invitation.
		lines.push(
			`ATTENDEE${name};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;SCHEDULE-AGENT=CLIENT:mailto:${event.attendeeEmail}`
		);
	}

	lines.push('STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR');

	return lines.map(foldLine).join('\r\n') + '\r\n';
}

function eventUrl(config: CalDAVConfig, uid: string): string {
	return `${config.calendarUrl}${encodeURIComponent(uid)}.ics`;
}

/**
 * Create (or replace) an event. Returns the UID stored against the booking.
 */
export async function createCalDAVEvent(
	config: CalDAVConfig,
	event: CalDAVEventInput
): Promise<string> {
	const response = await fetch(eventUrl(config, event.uid), {
		method: 'PUT',
		headers: {
			Authorization: authHeader(config),
			'Content-Type': 'text/calendar; charset=utf-8'
		},
		body: buildICS(event)
	});

	if (!response.ok) {
		throw new Error(`CalDAV event create failed: ${response.status} ${response.statusText}`);
	}

	return event.uid;
}

/**
 * Delete an event. A 404 counts as success — the desired end state is "gone".
 */
export async function deleteCalDAVEvent(config: CalDAVConfig, uid: string): Promise<void> {
	const response = await fetch(eventUrl(config, uid), {
		method: 'DELETE',
		headers: { Authorization: authHeader(config) }
	});

	if (!response.ok && response.status !== 404) {
		throw new Error(`CalDAV event delete failed: ${response.status} ${response.statusText}`);
	}
}
