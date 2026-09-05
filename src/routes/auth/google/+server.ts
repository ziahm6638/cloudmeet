/**
 * Google OAuth initiation.
 *
 * This is no longer the sign-in path (see /auth/login for password sign-in).
 * It exists to connect a Google Calendar to the admin account.
 */

import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAuthUrl } from '$lib/server/auth';

export const GET: RequestHandler = async ({ platform }) => {
	const env = platform?.env;
	if (!env) {
		throw new Error('Platform env not available');
	}

	const clientId = env.GOOGLE_CLIENT_ID;
	const appUrl = env.APP_URL;

	if (!clientId || !appUrl) {
		throw new Error('Missing OAuth configuration');
	}

	// Generate state token for CSRF protection
	const state = crypto.randomUUID();

	// Store state in KV for verification (expires in 10 minutes)
	await env.KV.put(`oauth_state:${state}`, '1', { expirationTtl: 600 });

	const redirectUri = `${appUrl}/auth/callback`;
	const authUrl = getAuthUrl(clientId, redirectUri, state);

	throw redirect(302, authUrl);
};
