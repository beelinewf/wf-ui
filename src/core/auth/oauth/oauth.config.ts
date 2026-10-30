import { config } from '@config/config';

import type { AuthConfig, OidcAuthConfig } from '@core/auth/types/AuthConfig';

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

// A deployment without SSO serves the config with the OIDC fields absent or empty.
export const requireOidcConfig = (cfg: AuthConfig): OidcAuthConfig => {
	if (!cfg.enabled || !cfg.issuer || !cfg.client_id || !cfg.authorization_url || !cfg.token_url) {
		throw new OAuthError(0, 'sso_unavailable', 'SSO is not configured on this engine.');
	}
	return {
		...cfg,
		issuer: cfg.issuer,
		client_id: cfg.client_id,
		authorization_url: cfg.authorization_url,
		token_url: cfg.token_url,
		scopes: cfg.scopes ?? [],
	};
};

/** The engine's config, rejected when it carries no OIDC provider. */
export const loadOidcConfig = async () => requireOidcConfig(await loadAuthConfig());

// /v1/auth/config has no logout endpoint, so it is read from the provider's discovery document.
export const loadOidcDiscovery = cached(async () => {
	const { issuer } = await loadOidcConfig();
	return fetchJson<OidcDiscovery>(`${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`);
});
