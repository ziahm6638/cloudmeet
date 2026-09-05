<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Sign in</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
	<div class="w-full max-w-sm">
		<div class="text-center mb-8">
			<h1 class="text-2xl font-bold text-gray-900">Sign in</h1>
			<p class="mt-2 text-sm text-gray-600">Meeting scheduler admin</p>
		</div>

		<form
			method="POST"
			class="bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-4"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			{#if form?.error}
				<div
					class="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800"
					role="alert"
				>
					{form.error}
				</div>
			{/if}

			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="username"
					required
					value={form?.email ?? ''}
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="w-full inline-flex justify-center items-center px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition font-medium"
			>
				{submitting ? 'Signing in…' : 'Sign in'}
			</button>
		</form>

		{#if data.googleAvailable}
			<p class="mt-6 text-center text-xs text-gray-500">
				Connect a Google Calendar from Dashboard → Calendars after signing in.
			</p>
		{/if}
	</div>
</div>
