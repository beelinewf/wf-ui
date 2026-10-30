import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { AUTH_ANONYMOUS_TOKEN } from '@core/auth/auth.constants';
import type { AuthMethod } from '@core/auth/types/AuthMethod';
import type { OAuthTokens } from '@core/auth/types/OAuthTokens';
import { LocalKVStore } from '@core/localKVStore';

const authStore = new LocalKVStore('auth');

const SESSION_KEY = 'session';
// Older builds stored a bare API key under this key.
const LEGACY_TOKEN_KEY = 'token';

interface AuthSession {
	method: AuthMethod;
	token: string;
	refreshToken: string | null;
	idToken: string | null;
	expiresAt: number | null;
}

export interface AuthState {
	method: AuthMethod | null;
	token: string | null;
	refreshToken: string | null;
	idToken: string | null;
	expiresAt: number | null;
	initialized: boolean;
	/** Set when a local session ended on its own, so the login page can say why the user is back there. */
	sessionExpired: boolean;
}

export interface LocalSession {
	token: string;
	/** Epoch milliseconds. */
	expiresAt: number;
}

type SessionFields = Omit<AuthState, 'initialized' | 'sessionExpired'>;

const emptySession: SessionFields = {
	method: null,
	token: null,
	refreshToken: null,
	idToken: null,
	expiresAt: null,
};

/** A local token cannot be refreshed, so once it is past its expiry the session is over. */
export const isLocalSessionExpired = (auth?: Pick<AuthState, 'method' | 'expiresAt'>) =>
	auth?.method === 'local' && !!auth.expiresAt && Date.now() >= auth.expiresAt;

const loadSession = (): SessionFields & { sessionExpired: boolean } => {
	const session = authStore.get<AuthSession>(SESSION_KEY);
	if (session?.token && session.method) {
		if (!isLocalSessionExpired(session)) return { ...session, sessionExpired: false };
		authStore.clear();
		return { ...emptySession, sessionExpired: true };
	}

	const legacyToken = authStore.get<string>(LEGACY_TOKEN_KEY);
	if (!legacyToken) return { ...emptySession, sessionExpired: false };

	authStore.delete(LEGACY_TOKEN_KEY);
	const migrated = authStore.set<AuthSession>(SESSION_KEY, { ...emptySession, method: 'apiKey', token: legacyToken });
	return { ...migrated, sessionExpired: false };
};

const persist = (state: AuthState) => {
	const { method, token, refreshToken, idToken, expiresAt } = state;
	if (method && token) authStore.set<AuthSession>(SESSION_KEY, { method, token, refreshToken, idToken, expiresAt });
};

const initialState: AuthState = {
	...loadSession(),
	initialized: true,
};

export const authSlice = createSlice({
	name: 'auth',
	initialState,
	reducers: {
		setApiKeySession: (state, action: PayloadAction<string>) => {
			Object.assign(state, emptySession, { method: 'apiKey', token: action.payload, sessionExpired: false });
			persist(state);
		},
		setOAuthSession: (state, action: PayloadAction<OAuthTokens>) => {
			const { accessToken, refreshToken, idToken, expiresAt } = action.payload;
			Object.assign(state, { method: 'oauth', token: accessToken, refreshToken, idToken, expiresAt });
			state.sessionExpired = false;
			persist(state);
		},
		// No refresh or id token: a local session simply ends at expiresAt.
		setLocalSession: (state, action: PayloadAction<LocalSession>) => {
			const { token, expiresAt } = action.payload;
			Object.assign(state, emptySession, { method: 'local', token, expiresAt, sessionExpired: false });
			persist(state);
		},
		// A refresh response may omit the refresh or id token, in which case the current ones stay valid.
		updateOAuthTokens: (state, action: PayloadAction<OAuthTokens>) => {
			if (state.method !== 'oauth') return;
			const { accessToken, refreshToken, idToken, expiresAt } = action.payload;
			state.token = accessToken;
			state.refreshToken = refreshToken ?? state.refreshToken;
			state.idToken = idToken ?? state.idToken;
			state.expiresAt = expiresAt;
			persist(state);
		},
		clearSession: (state) => {
			authStore.clear();
			Object.assign(state, emptySession);
		},
		/** Ends a session the user did not sign out of, e.g. a local token that expired or was revoked. */
		expireSession: (state) => {
			authStore.clear();
			Object.assign(state, emptySession, { sessionExpired: true });
		},
		dismissSessionExpired: (state) => {
			state.sessionExpired = false;
		},
	},
	selectors: {
		selectToken: (state) => state.token,
		selectAuthMethod: (state) => state.method,
		selectSessionExpired: (state) => state.sessionExpired,
		selectExpiresAt: (state) => state.expiresAt,
		selectIsAuthenticated: (state) => !!state.token,
		// The placeholder session of an engine with every login method off, which has no caller to describe.
		selectIsAnonymous: (state) => state.method === 'apiKey' && state.token === AUTH_ANONYMOUS_TOKEN,
	},
});

export const {
	setApiKeySession,
	setOAuthSession,
	setLocalSession,
	updateOAuthTokens,
	clearSession,
	expireSession,
	dismissSessionExpired,
} = authSlice.actions;
export const {
	selectToken,
	selectAuthMethod,
	selectSessionExpired,
	selectExpiresAt,
	selectIsAuthenticated,
	selectIsAnonymous,
} = authSlice.selectors;
