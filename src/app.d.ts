/// <reference types="@sveltejs/kit" />
/// <reference types="@cloudflare/workers-types" />

declare global {
	namespace App {
		interface Platform {
			env: {
				DB: D1Database;
				KV: KVNamespace;
				GOOGLE_CLIENT_ID: string;
				GOOGLE_CLIENT_SECRET: string;
				JWT_SECRET: string;
				BASE_URL: string;
				APP_URL?: string;
				ADMIN_EMAIL?: string;
				RESEND_API_KEY?: string;
				MEET_API_URL?: string;
				MEET_CLIENT_ID?: string;
				MEET_CLIENT_SECRET?: string;
				MEET_OWNER_EMAIL?: string;
				MEET_ROOM_ACCESS?: string;
				EMAIL_FROM?: string;
				TURNSTILE_SECRET_KEY?: string;
				CRON_SECRET?: string;
				NEXTCLOUD_URL?: string;
				NEXTCLOUD_USERNAME?: string;
				NEXTCLOUD_APP_PASSWORD?: string;
				NEXTCLOUD_CALENDAR?: string;
			};
			context: {
				waitUntil(promise: Promise<any>): void;
			};
			caches: CacheStorage & { default: Cache };
		}
		interface Locals {
			user?: {
				id: string;
				email: string;
				name: string;
			};
		}
	}
}

export {};