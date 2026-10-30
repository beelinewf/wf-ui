import type { BaseQueryApi } from '@reduxjs/toolkit/query';

import { AUTH_BEARER_HEADER, AUTH_TOKEN_HEADER } from '@core/auth/auth.constants';
import type { AuthState } from '@core/auth/store';

import type { HTTPHeader } from '@common/types/HTTPHeader';

export type CoreStoreApi = Pick<BaseQueryApi, 'dispatch' | 'getState'>;

export const getCoreAuth = (api: CoreStoreApi) => (api.getState() as { auth?: AuthState }).auth;

export const buildAuthHead = (auth?: AuthState): HTTPHeader => {
	if (!auth?.token) return {};
	// SSO and local logins both carry a JWT; only the API key travels in its own header.
	return auth.method === 'apiKey'
		? { [AUTH_TOKEN_HEADER]: auth.token }
		: { [AUTH_BEARER_HEADER]: `Bearer ${auth.token}` };
};
