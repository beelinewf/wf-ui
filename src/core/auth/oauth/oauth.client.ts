import { AUTH_CALLBACK_PATH, AUTH_LOGIN_PATH, OAUTH_EXTRA_SCOPES } from '@core/auth/auth.constants';
import type { AuthConfig } from '@core/auth/types/AuthConfig';
import type { OAuthTokens } from '@core/auth/types/OAuthTokens';

import { loadOidcConfig, loadOidcDiscovery, requireOidcConfig } from './oauth.config';
import { createCodeChallenge, decodeJwtPayload, randomToken } from './oauth.encoding';
import { OAuthError } from './oauth.error';
import { saveOAuthTransaction, takeOAuthTransaction } from './oauth.transaction';

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	expires_in?: number;
}

interface TokenErrorResponse {
	error?: string;
	error_description?: string;
}

export interface OAuthCallbackResult {
	tokens: OAuthTokens;
	returnTo: string;
}

const absoluteUrl = (path: string) => new URL(path, window.location.origin).toString();

// When the client id already serves as the audience the provider needs no resource indicator. Otherwise every grant
// must name it: a provider such as Logto answers a request without one with an opaque token the API cannot verify.
const resourceParam = (cfg: AuthConfig): Record<string, string> =>
	cfg.audience && cfg.audience !== cfg.client_id ? { resource: cfg.audience } : {};

const requestTokens = async (tokenUrl: string, params: Record<string, string>): Promise<OAuthTokens> => {
	const res = await fetch(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
		body: new URLSearchParams(params),
	});
	const body = (await res.json().catch(() => ({}))) as TokenResponse & TokenErrorResponse;

	if (!res.ok || !body.access_token) {
		throw new OAuthError(res.status, body.error ?? 'token_request_failed', body.error_description);
	}

	return {
		accessToken: body.access_token,
		refreshToken: body.refresh_token ?? null,
		idToken: body.id_token ?? null,
		expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : null,
	};
};

export const startOAuthLogin = async (authConfig: AuthConfig, returnTo: string): Promise<string> => {
	const cfg = requireOidcConfig(authConfig);
	const state = randomToken();
	const nonce = randomToken();
	const codeVerifier = randomToken();
	const redirectUri = absoluteUrl(AUTH_CALLBACK_PATH);
	const scopes = [...new Set([...cfg.scopes, ...OAUTH_EXTRA_SCOPES])];

	const url = new URL(cfg.authorization_url);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('client_id', cfg.client_id);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('scope', scopes.join(' '));
	url.searchParams.set('state', state);
	url.searchParams.set('nonce', nonce);
	url.searchParams.set('code_challenge', await createCodeChallenge(codeVerifier));
	url.searchParams.set('code_challenge_method', 'S256');
	// OIDC only grants offline_access (and so a refresh token) when the user is prompted for consent.
	if (scopes.includes('offline_access')) url.searchParams.set('prompt', 'consent');
	for (const [key, value] of Object.entries(resourceParam(cfg))) url.searchParams.set(key, value);

	saveOAuthTransaction({ state, nonce, codeVerifier, redirectUri, returnTo });
	return url.toString();
};

const runOAuthCallback = async (params: URLSearchParams): Promise<OAuthCallbackResult> => {
	const tx = takeOAuthTransaction(params.get('state') ?? '');

	const providerError = params.get('error');
	if (providerError) throw new OAuthError(0, providerError, params.get('error_description') ?? undefined);

	if (!tx) {
		throw new OAuthError(
			0,
			'invalid_state',
			'This login request expired or was not started here. Please try again.',
		);
	}

	const code = params.get('code');
	if (!code) throw new OAuthError(0, 'missing_code', 'The provider did not return an authorization code.');

	const cfg = await loadOidcConfig();
	const tokens = await requestTokens(cfg.token_url, {
		grant_type: 'authorization_code',
		code,
		redirect_uri: tx.redirectUri,
		client_id: cfg.client_id,
		code_verifier: tx.codeVerifier,
		...resourceParam(cfg),
	});

	if (tokens.idToken && decodeJwtPayload(tokens.idToken)?.nonce !== tx.nonce) {
		throw new OAuthError(0, 'invalid_nonce', 'The identity token does not match this login request.');
	}

	return { tokens, returnTo: tx.returnTo };
};

const callbacks = new Map<string, Promise<OAuthCallbackResult>>();

// An authorization code is single-use, and StrictMode runs effects twice, so every caller with the same callback URL
// shares one exchange.
export const completeOAuthLogin = (params: URLSearchParams): Promise<OAuthCallbackResult> => {
	const key = params.toString();
	let pending = callbacks.get(key);
	if (!pending) {
		pending = runOAuthCallback(params);
		callbacks.set(key, pending);
	}
	return pending;
};

export const refreshOAuthTokens = async (refreshToken: string): Promise<OAuthTokens> => {
	const cfg = await loadOidcConfig();
	return requestTokens(cfg.token_url, {
		grant_type: 'refresh_token',
		refresh_token: refreshToken,
		client_id: cfg.client_id,
		...resourceParam(cfg),
	});
};

// Returns null when the provider has no end-session endpoint, in which case logout stays local.
export const buildOAuthLogoutUrl = async (idToken: string | null): Promise<string | null> => {
	const [cfg, discovery] = await Promise.all([loadOidcConfig(), loadOidcDiscovery()]);
	if (!discovery.end_session_endpoint) return null;

	const url = new URL(discovery.end_session_endpoint);
	url.searchParams.set('client_id', cfg.client_id);
	url.searchParams.set('post_logout_redirect_uri', absoluteUrl(AUTH_LOGIN_PATH));
	if (idToken) url.searchParams.set('id_token_hint', idToken);
	return url.toString();
};
