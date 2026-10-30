import { useNavigate } from 'react-router';

import { coreApi } from '@core/api';
import { authApi } from '@core/auth/api';
import { AUTH_LOGIN_PATH } from '@core/auth/auth.constants';
import { buildOAuthLogoutUrl } from '@core/auth/oauth';
import { clearSession, selectIsAnonymous, selectIsAuthenticated, setLocalSession } from '@core/auth/store';
import { useCoreDispatch, useCoreSelector, useCoreStore } from '@core/store';

export const {
	useGetAuthConfigQuery,
	useGetMeQuery,
	useVerifyApiTokenMutation,
	useLoginLocalMutation,
	useRegisterLocalMutation,
	useVerifyEmailMutation,
	useResendVerificationMutation,
} = authApi;

export const useLogout = () => {
	const navigate = useNavigate();
	const dispatch = useCoreDispatch();
	const store = useCoreStore();

	return async () => {
		const { method, idToken } = store.getState().auth;
		// The provider URL is built before the session is cleared, since it needs the id token as a hint. A local
		// session has no provider to sign out of, so clearing it is the whole logout.
		const providerLogoutUrl = method === 'oauth' ? await buildOAuthLogoutUrl(idToken).catch(() => null) : null;

		dispatch(clearSession());
		dispatch(coreApi.util.resetApiState());

		if (providerLogoutUrl) window.location.assign(providerLogoutUrl);
		else navigate(AUTH_LOGIN_PATH, { replace: true });
	};
};

/**
 * Turns a local login, verification or registration response into the session. The cache is dropped first, so
 * nothing the previous (expired) session fetched is shown to the new one.
 */
export const useStartLocalSession = () => {
	const dispatch = useCoreDispatch();

	return ({ access_token, expires_in }: { access_token: string; expires_in: number }) => {
		dispatch(coreApi.util.resetApiState());
		dispatch(setLocalSession({ token: access_token, expiresAt: Date.now() + expires_in * 1000 }));
	};
};

/** The signed-in caller, sharing the cache entry the authorization gates read. Skipped when there is no caller. */
export const useMe = () => {
	const isAnonymous = useCoreSelector(selectIsAnonymous);
	const isAuthenticated = useCoreSelector(selectIsAuthenticated);
	return authApi.useGetMeQuery(undefined, { skip: isAnonymous || !isAuthenticated });
};
