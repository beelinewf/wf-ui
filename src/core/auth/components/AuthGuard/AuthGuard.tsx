import React, { useEffect } from 'react';

import { Navigate, Outlet, useLocation } from 'react-router';

import { AUTH_LOGIN_PATH } from '@core/auth/auth.constants';
import { readReturnTo } from '@core/auth/auth.utils';
import { expireSession, selectAuthMethod, selectExpiresAt, selectIsAuthenticated } from '@core/auth/store';
import { useCoreDispatch, useCoreSelector } from '@core/store';

// setTimeout overflows past ~24.8 days; a longer token is simply checked again after this.
const MAX_TIMER_MS = 2_147_483_647;

/** Ends a local session at its expiry even while the tab sits idle, since it has no refresh to keep it alive. */
const useLocalSessionExpiry = () => {
	const dispatch = useCoreDispatch();
	const method = useCoreSelector(selectAuthMethod);
	const expiresAt = useCoreSelector(selectExpiresAt);

	useEffect(() => {
		if (method !== 'local' || !expiresAt) return;
		const delay = expiresAt - Date.now();
		if (delay <= 0) {
			dispatch(expireSession());
			return;
		}
		const timer = setTimeout(
			() => {
				if (Date.now() >= expiresAt) dispatch(expireSession());
			},
			Math.min(delay, MAX_TIMER_MS),
		);
		return () => clearTimeout(timer);
	}, [dispatch, method, expiresAt]);
};

export const RequireAuth: React.FC = () => {
	const isAuthenticated = useCoreSelector(selectIsAuthenticated);
	const location = useLocation();
	useLocalSessionExpiry();

	// The current path rides along so login can bring the user back to it.
	return isAuthenticated ? (
		<Outlet />
	) : (
		<Navigate to={AUTH_LOGIN_PATH} replace state={{ from: `${location.pathname}${location.search}` }} />
	);
};

export const RequireGuest: React.FC = () => {
	const isAuthenticated = useCoreSelector(selectIsAuthenticated);
	const location = useLocation();

	return isAuthenticated ? <Navigate to={readReturnTo(location.state)} replace /> : <Outlet />;
};
