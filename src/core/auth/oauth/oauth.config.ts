import { config } from '@config/config';

import type { AuthConfig } from '@core/auth/types/AuthConfig';

import { OAuthError } from './oauth.error';

interface OidcDiscovery {
	end_session_endpoint?: string;
}

const fetchJson = async <T>(url: string): Promise<T> => {
	const res = await fetch(url, { headers: { Accept: 'application/json' } });
	if (!res.ok) throw new OAuthError(res.status, 'request_failed', `${url} answered ${res.status}`);
	return (await res.json()) as T;
};

const cached = <T>(load: () => Promise<T>) => {
	let pending: Promise<T> | null = null;
	return () => {
		// A failed load is dropped so the next caller retries instead of reusing the rejection.
		pending ??= load().catch((err: unknown) => {
			pending = null;
			throw err;
		});
		return pending;
	};
};

// Plain fetch rather than coreApi: the token refresh inside the base query needs this, and going through coreApi
// would make the base query depend on itself.
export const loadAuthConfig = cached(async () => {
	const { BEELINE_UI_API } = await config.getValue();
	return fetchJson<AuthConfig>(`${BEELINE_UI_API.replace(/\/+$/, '')}/v1/auth/config`);
});

// /v1/auth/config has no logout endpoint, so it is read from the provider's discovery document.
export const loadOidcDiscovery = cached(async () => {
	const { issuer } = await loadAuthConfig();
	return fetchJson<OidcDiscovery>(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`);
});
