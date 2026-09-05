/**
 * Password hashing and verification using PBKDF2 via the Web Crypto API.
 *
 * Runs unmodified on Cloudflare Workers (no node:crypto, no native deps).
 * Stored format: pbkdf2$sha256$<iterations>$<salt-b64>$<hash-b64>
 */

const ITERATIONS = 210_000;
const KEY_LENGTH = 32; // bytes
const SALT_LENGTH = 16; // bytes

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function derive(
	password: string,
	salt: Uint8Array,
	iterations: number
): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);

	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
		key,
		KEY_LENGTH * 8
	);

	return new Uint8Array(bits);
}

/**
 * Hash a plaintext password for storage in users.password_hash.
 */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const hash = await derive(password, salt, ITERATIONS);
	return `pbkdf2$sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * Constant-time comparison of two byte arrays.
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) {
		return false;
	}
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a[i] ^ b[i];
	}
	return diff === 0;
}

/**
 * Verify a plaintext password against a stored hash.
 * Returns false for malformed or missing hashes rather than throwing.
 */
export async function verifyPassword(
	password: string,
	stored: string | null | undefined
): Promise<boolean> {
	if (!stored) {
		return false;
	}

	const parts = stored.split('$');
	if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
		return false;
	}

	const iterations = Number(parts[2]);
	if (!Number.isInteger(iterations) || iterations < 1000) {
		return false;
	}

	try {
		const salt = fromBase64(parts[3]);
		const expected = fromBase64(parts[4]);
		const actual = await derive(password, salt, iterations);
		return timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

/**
 * Minimum password policy for the single admin account.
 */
export function validatePassword(password: string): string | null {
	if (password.length < 12) {
		return 'Password must be at least 12 characters.';
	}
	if (password.length > 200) {
		return 'Password must be 200 characters or fewer.';
	}
	return null;
}
