/**
 * Minimal Resend transport (https://resend.com/docs/api-reference/emails/send-email).
 * Uses fetch directly so it runs on Cloudflare Pages without an SDK dependency.
 */
export interface ResendMessage {
	apiKey: string;
	from: string;
	to: string;
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
}

export async function sendViaResend(msg: ResendMessage, context: string): Promise<void> {
	const response = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${msg.apiKey}`
		},
		body: JSON.stringify({
			from: msg.from,
			to: [msg.to],
			subject: msg.subject,
			html: msg.html,
			...(msg.text ? { text: msg.text } : {}),
			...(msg.replyTo ? { reply_to: msg.replyTo } : {})
		})
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`Failed to send ${context} (Resend ${response.status}): ${error}`);
	}
}
