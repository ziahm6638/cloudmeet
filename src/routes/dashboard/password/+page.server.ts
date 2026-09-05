/**
 * Change the admin account password.
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCurrentUser } from '$lib/server/auth';
import { hashPassword, validatePassword, verifyPassword } from '$lib/server/password';

export const load: PageServerLoad = async (event) => {
	const userId = await getCurrentUser(event);
	if (!userId) {
		throw redirect(302, '/auth/login');
	}

	const db = event.platform?.env?.DB;
	const user = db
		? await db
				.prepare('SELECT email FROM users WHERE id = ?')
				.bind(userId)
				.first<{ email: string }>()
		: null;

	return { email: user?.email ?? null };
};

export const actions: Actions = {
	default: async (event) => {
		const userId = await getCurrentUser(event);
		if (!userId) {
			throw redirect(302, '/auth/login');
		}

		const db = event.platform?.env?.DB;
		if (!db) {
			return fail(500, { error: 'Database unavailable.' });
		}

		const form = await event.request.formData();
		const currentPassword = String(form.get('currentPassword') ?? '');
		const newPassword = String(form.get('newPassword') ?? '');
		const confirmPassword = String(form.get('confirmPassword') ?? '');

		const user = await db
			.prepare('SELECT password_hash FROM users WHERE id = ?')
			.bind(userId)
			.first<{ password_hash: string | null }>();

		if (!(await verifyPassword(currentPassword, user?.password_hash))) {
			return fail(401, { error: 'Current password is incorrect.' });
		}

		const policyError = validatePassword(newPassword);
		if (policyError) {
			return fail(400, { error: policyError });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { error: 'New passwords do not match.' });
		}

		await db
			.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
			.bind(await hashPassword(newPassword), userId)
			.run();

		return { success: true };
	}
};
