/**
 * Availability cache invalidation.
 *
 * /api/availability caches a day's slots under `availability:<slug>:<date>` and
 * /api/availability/month caches which days have slots under
 * `availability:month:<slug>:<YYYY-MM>`, both for 5 minutes. Any write that
 * frees or occupies time must drop BOTH keys for every affected date, or a
 * booker keeps seeing the pre-write picture — a canceled slot stays invisible
 * and a taken slot stays offered.
 */

interface KVLike {
	delete(key: string): Promise<void>;
}

/**
 * Drop the day and month availability caches for the given event and dates.
 * Accepts ISO timestamps or YYYY-MM-DD strings; invalid or duplicate dates are
 * ignored. Never throws: a failed purge must not fail the booking write.
 */
export async function invalidateAvailabilityCache(
	kv: KVLike | undefined,
	eventSlug: string | null | undefined,
	dates: Array<string | null | undefined>
): Promise<void> {
	if (!kv || !eventSlug) {
		return;
	}

	const keys = new Set<string>();

	for (const value of dates) {
		if (!value) {
			continue;
		}

		const day = value.length === 10 ? value : new Date(value).toISOString().split('T')[0];
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
			continue;
		}

		keys.add(`availability:${eventSlug}:${day}`);
		keys.add(`availability:month:${eventSlug}:${day.slice(0, 7)}`);
	}

	try {
		await Promise.all([...keys].map((key) => kv.delete(key)));
	} catch (err) {
		console.error('Failed to invalidate availability cache:', err);
	}
}
