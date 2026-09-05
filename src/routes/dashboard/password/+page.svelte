<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head>
	<title>Change password</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-2xl mx-auto px-4 py-8">
		<a href="/dashboard" class="text-sm text-gray-500 hover:text-gray-700">← Back to dashboard</a>

		<h1 class="mt-4 text-2xl font-bold text-gray-900">Change password</h1>
		{#if data.email}
			<p class="mt-1 text-sm text-gray-600">Signed in as {data.email}</p>
		{/if}

		<form
			method="POST"
			class="mt-6 bg-white shadow-sm border border-gray-200 rounded-lg p-6 space-y-4"
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

			{#if form?.success}
				<div
					class="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800"
					role="status"
				>
					Password updated.
				</div>
			{/if}

			<div>
				<label for="currentPassword" class="block text-sm font-medium text-gray-700">
					Current password
				</label>
				<input
					id="currentPassword"
					name="currentPassword"
					type="password"
					autocomplete="current-password"
					required
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="newPassword" class="block text-sm font-medium text-gray-700">
					New password
				</label>
				<input
					id="newPassword"
					name="newPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="12"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
				<p class="mt-1 text-xs text-gray-500">At least 12 characters.</p>
			</div>

			<div>
				<label for="confirmPassword" class="block text-sm font-medium text-gray-700">
					Confirm new password
				</label>
				<input
					id="confirmPassword"
					name="confirmPassword"
					type="password"
					autocomplete="new-password"
					required
					minlength="12"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>

			<button
				type="submit"
				disabled={submitting}
				class="inline-flex justify-center items-center px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition font-medium"
			>
				{submitting ? 'Saving…' : 'Update password'}
			</button>
		</form>
	</div>
</div>
