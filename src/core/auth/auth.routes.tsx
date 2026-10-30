import React from 'react';

import { Navigate, type RouteObject } from 'react-router';

import { RequireGuest } from './components/AuthGuard';
import { LoginPage } from './pages/LoginPage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResendVerificationPage } from './pages/ResendVerificationPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export const authRoutes: RouteObject = {
	path: 'auth',
	children: [
		{
			Component: RequireGuest,
			children: [
				{
					index: true,
					Component: () => <Navigate to={'login'} />,
				},
				{
					path: 'login',
					Component: LoginPage,
				},
				{
					path: 'register',
					Component: RegisterPage,
				},
				{
					path: 'resend-verification',
					Component: ResendVerificationPage,
				},
			],
		},
		// Kept outside the guest guard: the guard would redirect to /app as soon as the session lands, before the
		// callback can send the user to the page they started from.
		{
			path: 'callback',
			Component: OAuthCallbackPage,
		},
	],
};

// Top level and outside both guards: the engine mails {auth.local.public_base_url}/verify-email?token=…, and the link
// may be opened signed in or out.
export const verifyEmailRoute: RouteObject = {
	path: 'verify-email',
	Component: VerifyEmailPage,
};
