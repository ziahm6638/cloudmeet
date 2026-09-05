/**
 * Password sign-in for the single admin account.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSessionToken, getCurrentUser } from '$lib/server/auth';
import { verifyPassword } from '$lib/server/password';

const MAX_ATTEMPTS = 10;
const LOCKOUT_WINDOW_SECONDS = 15 * 60;

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (userId) {
		throw redirect(302, '/dashboard');
	}

	return {
		googleAvailable: !!(
			event.platform?.env?.GOOGLE_CLIENT_ID && event.platform?.env?.GOOGLE_CLIENT_SECRET
		)
	};
};

export const actions: Actions = {
	default: async (event) => {
		const env = event.platform?.env;
		if (!env?.DB || !env.JWT_SECRET) {
			return fail(500, { error: 'Server is not configured for sign-in.' });
		}

		const form = await event.request.formData();
		const email = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(form.get('password') ?? '');

		if (!email || !password) {
			return fail(400, { email, error: 'Enter your email and password.' });
		}

		// Throttle repeated failures per client IP.
		const ip = event.getClientAddress();
		const attemptsKey = `login_attempts:${ip}`;
		const attempts = env.KV ? Number((await env.KV.get(attemptsKey)) ?? '0') : 0;

		if (attempts >= MAX_ATTEMPTS) {
			return fail(429, {
				email,
				error: 'Too many failed attempts. Try again in 15 minutes.'
			});
		}

		const user = await env.DB.prepare(
			'SELECT id, password_hash FROM users WHERE lower(email) = ?'
		)
			.bind(email)
			.first<{ id: string; password_hash: string | null }>();

		const valid = await verifyPassword(password, user?.password_hash);

		if (!user || !valid) {
			if (env.KV) {
				await env.KV.put(attemptsKey, String(attempts + 1), {
					expirationTtl: LOCKOUT_WINDOW_SECONDS
				});
			}
			// Same message for unknown email and wrong password.
			return fail(401, { email, error: 'Incorrect email or password.' });
		}

		if (env.KV) {
			await env.KV.delete(attemptsKey);
		}

		const sessionToken = await createSessionToken(user.id, env.JWT_SECRET);
		const appUrl = env.APP_URL ?? '';

		event.cookies.set('session', sessionToken, {
			path: '/',
			httpOnly: true,
			secure: appUrl.startsWith('https'),
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		throw redirect(302, '/dashboard');
	}
};
