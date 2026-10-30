import React, { useState } from 'react';

import { Alert, Anchor, Button, Group, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuMailWarning, LuTriangleAlert } from 'react-icons/lu';
import { Link, useLocation } from 'react-router';

import { queryErrorCode, queryErrorMessage, queryRetryAfter } from '@core/api';
import { AUTH_REGISTER_PATH, AUTH_RESEND_VERIFICATION_PATH } from '@core/auth/auth.constants';
import { ResendVerificationButton } from '@core/auth/components/ResendVerificationButton';
import { localLoginInitialValues, localLoginSchema, type LocalLoginDto } from '@core/auth/dto';
import { useLoginLocalMutation, useStartLocalSession } from '@core/auth/hooks';
import type { AuthConfig } from '@core/auth/types/AuthConfig';

import { useCooldown } from '@common/hooks/useCooldown';

interface LocalLoginFormProps {
	authConfig: AuthConfig;
	/** Called once the session is in the store. */
	onSignedIn: () => void;
}

type LoginFailure = { type: 'error'; message: string } | { type: 'unverified'; email: string };

export const LocalLoginForm: React.FC<LocalLoginFormProps> = ({ authConfig, onSignedIn }) => {
	// Carried to register / resend so a sign-in from there still returns to the page the user started on.
	const { state: locationState } = useLocation();
	const [login, { isLoading }] = useLoginLocalMutation();
	const startLocalSession = useStartLocalSession();
	const cooldown = useCooldown();
	const [failure, setFailure] = useState<LoginFailure | null>(null);

	const form = useForm<LocalLoginDto>({
		mode: 'controlled',
		initialValues: localLoginInitialValues,
		validate: (values) => {
			const result = localLoginSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	const handleSubmit = async (values: LocalLoginDto) => {
		setFailure(null);
		try {
			const session = await login({ email: values.email.trim(), password: values.password }).unwrap();
			startLocalSession(session);
			onSignedIn();
		} catch (error) {
			const wait = queryRetryAfter(error);
			if (wait) {
				cooldown.start(wait);
				return;
			}
			const code = queryErrorCode(error);
			if (code === 401) setFailure({ type: 'error', message: 'Email or password is incorrect' });
			else if (code === 403) setFailure({ type: 'unverified', email: values.email.trim() });
			else
				setFailure({ type: 'error', message: queryErrorMessage(error, 'Unable to reach the workflow engine') });
		}
	};

	return (
		<form onSubmit={form.onSubmit(handleSubmit)} noValidate>
			<Stack gap="md">
				<TextInput
					label="Email"
					placeholder="you@example.com"
					type="email"
					size="md"
					autoComplete="username"
					data-autofocus
					{...form.getInputProps('email')}
				/>
				<PasswordInput
					label="Password"
					size="md"
					autoComplete="current-password"
					{...form.getInputProps('password')}
					error={form.errors.password ?? (failure?.type === 'error' && failure.message)}
				/>

				{cooldown.active && (
					<Alert variant="light" color="yellow" icon={<LuTriangleAlert size={16} aria-hidden />}>
						Too many attempts, try again in {cooldown.remaining} s.
					</Alert>
				)}

				{failure?.type === 'unverified' && (
					<Alert variant="light" color="yellow" icon={<LuMailWarning size={16} aria-hidden />}>
						<Stack gap="xs">
							<Text fz="sm">
								Verify your email first. Open the link we sent to {failure.email}, or get a new one.
							</Text>
							<ResendVerificationButton email={failure.email} size="xs" />
						</Stack>
					</Alert>
				)}

				<Button type="submit" size="md" fullWidth loading={isLoading} disabled={cooldown.active}>
					Log In
				</Button>

				{(authConfig.registration_enabled || authConfig.email_verification_enabled) && (
					<Group justify="space-between" gap="xs">
						{authConfig.registration_enabled ? (
							<Text fz="sm" c="dimmed">
								New here?{' '}
								<Anchor component={Link} to={AUTH_REGISTER_PATH} state={locationState} fz="sm">
									Create an account
								</Anchor>
							</Text>
						) : (
							<span />
						)}
						{authConfig.email_verification_enabled && (
							<Anchor
								component={Link}
								to={AUTH_RESEND_VERIFICATION_PATH}
								state={locationState}
								fz="sm"
								c="dimmed"
							>
								Resend verification email
							</Anchor>
						)}
					</Group>
				)}
			</Stack>
		</form>
	);
};
