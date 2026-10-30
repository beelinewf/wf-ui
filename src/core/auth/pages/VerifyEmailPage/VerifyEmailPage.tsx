import React, { useEffect, useState } from 'react';

import { Anchor, Button, Center, Loader, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { LuArrowRight, LuCircleCheck, LuLink2Off, LuTriangleAlert } from 'react-icons/lu';
import { Link, useSearchParams } from 'react-router';

import { queryRetryAfter } from '@core/api';
import { authApi } from '@core/auth/api';
import { AUTH_HOME_PATH, AUTH_LOGIN_PATH } from '@core/auth/auth.constants';
import { AuthLayout } from '@core/auth/components/AuthLayout';
import { ResendVerificationButton } from '@core/auth/components/ResendVerificationButton';
import { emailSchema } from '@core/auth/dto';
import { useStartLocalSession } from '@core/auth/hooks';
import { selectIsAuthenticated } from '@core/auth/store';
import type { LoginResponse } from '@core/auth/types/LocalAuth';
import { useCoreDispatch, useCoreSelector, type CoreDispatch } from '@core/store';

type VerifyState =
	| { type: 'pending' }
	| { type: 'verified' }
	| { type: 'invalid' }
	| { type: 'limited'; retryAfter: number };

const attempts = new Map<string, Promise<LoginResponse>>();

// The token is single-use and StrictMode runs effects twice, so every mount for the same token shares one request.
const verifyOnce = (dispatch: CoreDispatch, token: string) => {
	let pending = attempts.get(token);
	if (!pending) {
		pending = dispatch(authApi.endpoints.verifyEmail.initiate({ token })).unwrap();
		attempts.set(token, pending);
		// A rate-limited attempt never reached the token, so it may be tried again later.
		pending.catch((error: unknown) => {
			if (queryRetryAfter(error)) attempts.delete(token);
		});
	}
	return pending;
};

/** The target of the mailed link. Reachable signed in or out, since either may click it. */
export const VerifyEmailPage: React.FC = () => {
	const [searchParams] = useSearchParams();
	const token = searchParams.get('token')?.trim() ?? '';
	const dispatch = useCoreDispatch();
	const isAuthenticated = useCoreSelector(selectIsAuthenticated);
	const startLocalSession = useStartLocalSession();
	const [state, setState] = useState<VerifyState>(() => (token ? { type: 'pending' } : { type: 'invalid' }));
	const [attempt, setAttempt] = useState(0);
	const [email, setEmail] = useState('');

	useEffect(() => {
		if (!token) return;
		let cancelled = false;

		verifyOnce(dispatch, token)
			.then((session) => {
				if (cancelled) return;
				// An existing session (perhaps another account) is left alone; otherwise the link signs the user in.
				if (!isAuthenticated) startLocalSession(session);
				setState({ type: 'verified' });
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				const wait = queryRetryAfter(error);
				setState(wait ? { type: 'limited', retryAfter: wait } : { type: 'invalid' });
			});

		return () => {
			cancelled = true;
		};
		// Only the token (and a manual retry) start a verification; the session flips once it succeeds.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token, attempt]);

	if (state.type === 'pending') {
		return (
			<AuthLayout title="Verifying your email">
				<Center py="xl">
					<Loader size="sm" />
				</Center>
			</AuthLayout>
		);
	}

	if (state.type === 'verified') {
		return (
			<AuthLayout title="Email verified">
				<Stack gap="lg" align="center" ta="center">
					<ThemeIcon size={56} radius="xl" variant="light" color="teal">
						<LuCircleCheck size={26} />
					</ThemeIcon>
					<Text fz="sm">Your email is confirmed and your account is active.</Text>
					<Button
						size="md"
						fullWidth
						component={Link}
						to={AUTH_HOME_PATH}
						replace
						rightSection={<LuArrowRight size={18} />}
					>
						Continue
					</Button>
				</Stack>
			</AuthLayout>
		);
	}

	if (state.type === 'limited') {
		return (
			<AuthLayout title="Too many attempts">
				<Stack gap="lg" align="center" ta="center">
					<ThemeIcon size={56} radius="xl" variant="light" color="yellow">
						<LuTriangleAlert size={26} />
					</ThemeIcon>
					<Text fz="sm">Wait about {state.retryAfter} s, then try the link again.</Text>
					<Button
						variant="light"
						fullWidth
						onClick={() => {
							setState({ type: 'pending' });
							setAttempt((value) => value + 1);
						}}
					>
						Try again
					</Button>
				</Stack>
			</AuthLayout>
		);
	}

	const validEmail = emailSchema.safeParse(email).success;

	return (
		<AuthLayout title="Link invalid or expired">
			<Stack gap="lg">
				<Stack gap="xs" align="center" ta="center">
					<ThemeIcon size={56} radius="xl" variant="light" color="gray">
						<LuLink2Off size={26} />
					</ThemeIcon>
					<Text fz="sm">
						This verification link is invalid or has expired. Links work once and only for a limited time.
						Enter your email to get a new one.
					</Text>
				</Stack>
				<TextInput
					label="Email"
					placeholder="you@example.com"
					type="email"
					size="md"
					autoComplete="email"
					value={email}
					onChange={(event) => setEmail(event.currentTarget.value)}
				/>
				<ResendVerificationButton email={validEmail ? email : ''} size="md" fullWidth label="Send a new link" />
				<Center>
					<Anchor component={Link} to={isAuthenticated ? AUTH_HOME_PATH : AUTH_LOGIN_PATH} fz="sm">
						{isAuthenticated ? 'Back to the app' : 'Back to sign in'}
					</Anchor>
				</Center>
			</Stack>
		</AuthLayout>
	);
};
