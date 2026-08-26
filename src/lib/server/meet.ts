/**
 * Self-hosted La Suite Meet integration (https://github.com/suitenumerique/meet).
 *
 * Creates one room per booking through Meet's external Application API:
 *   POST /external-api/v1.0/application/token/  (client_credentials, scope = owner email)
 *   POST /external-api/v1.0/rooms/               (Bearer token)
 * The meeting URL is `${MEET_API_URL}/${slug}`.
 */
export interface MeetEnv {
	MEET_API_URL?: string;      // e.g. https://meet.zzapp.uk
	MEET_CLIENT_ID?: string;
	MEET_CLIENT_SECRET?: string;
	MEET_OWNER_EMAIL?: string;  // existing Meet user who will own the rooms
	MEET_ROOM_ACCESS?: string;  // 'public' (knock-free) or 'trusted' (lobby); default public
}

export function isMeetConfigured(env: MeetEnv): boolean {
	return !!(env.MEET_API_URL && env.MEET_CLIENT_ID && env.MEET_CLIENT_SECRET && env.MEET_OWNER_EMAIL);
}

async function getAccessToken(env: MeetEnv, base: string): Promise<string> {
	const res = await fetch(`${base}/external-api/v1.0/application/token/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			grant_type: 'client_credentials',
			client_id: env.MEET_CLIENT_ID,
			client_secret: env.MEET_CLIENT_SECRET,
			scope: env.MEET_OWNER_EMAIL
		})
	});
	if (!res.ok) throw new Error(`Meet token request failed (${res.status}): ${await res.text()}`);
	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) throw new Error('Meet token response had no access_token');
	return data.access_token;
}

async function createRoom(base: string, token: string, name: string, accessLevel?: string) {
	const res = await fetch(`${base}/external-api/v1.0/rooms/`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(accessLevel ? { name, access_level: accessLevel } : { name })
	});
	const text = await res.text();
	if (!res.ok) throw new Error(`Meet room creation failed (${res.status}): ${text}`);
	const data = JSON.parse(text) as { slug?: string; access_level?: string };
	if (!data.slug) throw new Error('Meet room response had no slug');
	return data;
}

/**
 * Create a dedicated Meet room for a booking and return its join URL.
 * Tries the configured access level first (default 'public'); if the server refuses
 * public rooms (EXTERNAL_API_ALLOW_PUBLIC_ACCESS=false) it retries with the server default.
 * Throws if the API is unavailable — callers should fall back to a permanent room.
 */
export async function createMeetRoom(env: MeetEnv, name: string): Promise<{ url: string; accessLevel: string }> {
	if (!isMeetConfigured(env)) throw new Error('Meet is not configured');
	const base = env.MEET_API_URL!.replace(/\/+$/, '');
	const token = await getAccessToken(env, base);
	const wanted = env.MEET_ROOM_ACCESS || 'public';
	let room;
	try {
		room = await createRoom(base, token, name, wanted);
	} catch (err) {
		if (!String(err).includes('disabled for the external API')) throw err;
		console.warn(`Meet refused access_level=${wanted}; falling back to server default`);
		room = await createRoom(base, token, name);
	}
	return { url: `${base}/${room.slug}`, accessLevel: room.access_level || 'unknown' };
}
