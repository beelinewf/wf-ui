import React, { useState } from 'react';

import { Alert, Anchor, Button, Center, Loader, PasswordInput, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuArrowLeft, LuCircleAlert, LuMailCheck, LuTriangleAlert } from 'react-icons/lu';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';

import { queryErrorCode, queryErrorMessage, queryRetryAfter } from '@core/api';
import { AUTH_LOGIN_PATH } from '@core/auth/auth.constants';
import { readReturnTo } from '@core/auth/auth.utils';
import { AuthLayout } from '@core/auth/components/AuthLayout';
import { PasswordRequirements } from '@core/auth/components/PasswordRequirements';
import { ResendVerificationButton } from '@core/auth/components/ResendVerificationButton';
import { registerInitialValues, registerSchema, type RegisterDto } from '@core/auth/dto';
import { useGetAuthConfigQuery, useRegisterLocalMutation, useStartLocalSession } from '@core/auth/hooks';

import { useCooldown } from '@common/hooks/useCooldown';

type RegisterFailure = { type: 'exists' } | { type: 'error'; message: string };

export const RegisterPage: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const { data: authConfig, isLoading: isConfigLoading } = useGetAuthConfigQuery();
	const [register, { isLoading }] = useRegisterLocalMutation();
	const startLocalSession = useStartLocalSession();
	const cooldown = useCooldown();
	const [failure, setFailure] = useState<RegisterFailure | null>(null);
	const [pendingEmail, setPendingEmail] = useState<string | null>(null);

	const form = useForm<RegisterDto>({
		mode: 'controlled',
		initialValues: registerInitialValues,
		validate: (values) => {
			const result = registerSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	if (isConfigLoading) {
		return (
			<AuthLayout title="Create an account">
				<Center py="xl">
					<Loader size="sm" />
				</Center>
			</AuthLayout>
		);
	}

	if (!authConfig?.local_enabled || !authConfig.registration_enabled) {
		return <Navigate to={AUTH_LOGIN_PATH} replace state={location.state} />;
	}

	const handleSubmit = async (values: RegisterDto) => {
		setFailure(null);
		const email = values.email.trim();
		try {
			const result = await register({ name: values.name.trim(), email, password: values.password }).unwrap();
			if (result.pending_verification || !result.access_token || !result.expires_in) {
				setPendingEmail(email);
				return;
			}
			startLocalSession({ access_token: result.access_token, expires_in: result.expires_in });
			navigate(readReturnTo(location.state), { replace: true });
		} catch (error) {
			const wait = queryRetryAfter(error);
			if (wait) {
				cooldown.start(wait);
				return;
			}
			const code = queryErrorCode(error);
			if (code === 409) {
				setFailure({ type: 'exists' });
			} else if (code === 403) {
				// Registration closed between loading the page and submitting it.
				navigate(AUTH_LOGIN_PATH, { replace: true, state: location.state });
			} else {
				setFailure({ type: 'error', message: queryErrorMessage(error, "Couldn't create the account") });
			}
		}
	};

	const backToSignIn = (
		<Anchor component={Link} to={AUTH_LOGIN_PATH} state={location.state} fz="sm">
			<Text span inherit display="inline-flex" style={{ alignItems: 'center', gap: 4 }}>
				<LuArrowLeft size={14} aria-hidden />
				Back to sign in
			</Text>
		</Anchor>
	);

	if (pendingEmail) {
		return (
			<AuthLayout title="Check your inbox">
				<Stack gap="lg" align="center" ta="center">
					<ThemeIcon size={56} radius="xl" variant="light">
						<LuMailCheck size={26} />
					</ThemeIcon>
					<Text fz="sm">
						We sent a verification link to{' '}
						<Text span fw={600}>
							{pendingEmail}
						</Text>
						. Open it to activate your account, then sign in.
					</Text>
					<ResendVerificationButton email={pendingEmail} fullWidth />
					{backToSignIn}
				</Stack>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout title="Create an account" subtitle="Sign up with your email and a password">
			<form onSubmit={form.onSubmit(handleSubmit)} noValidate>
				<Stack gap="md">
					<TextInput
						label="Name"
						size="md"
						autoComplete="name"
						data-autofocus
						{...form.getInputProps('name')}
					/>
					<TextInput
						label="Email"
						placeholder="you@example.com"
						type="email"
						size="md"
						autoComplete="email"
						{...form.getInputProps('email')}
						error={
							form.errors.email ??
							(failure?.type === 'exists' && 'An account with this email already exists')
						}
					/>
					<Stack gap={6}>
						<PasswordInput
							label="Password"
							size="md"
							autoComplete="new-password"
							{...form.getInputProps('password')}
						/>
						<PasswordRequirements password={form.values.password} />
					</Stack>
					<PasswordInput
						label="Confirm password"
						size="md"
						autoComplete="new-password"
						{...form.getInputProps('confirmPassword')}
					/>

					{failure?.type === 'exists' && (
						<Text fz="sm" c="dimmed">
							Already registered?{' '}
							<Anchor component={Link} to={AUTH_LOGIN_PATH} state={location.state} fz="sm">
								Sign in instead
							</Anchor>
						</Text>
					)}

					{failure?.type === 'error' && (
						<Alert variant="light" color="red" icon={<LuCircleAlert size={16} aria-hidden />}>
							{failure.message}
						</Alert>
					)}

					{cooldown.active && (
						<Alert variant="light" color="yellow" icon={<LuTriangleAlert size={16} aria-hidden />}>
							Too many attempts, try again in {cooldown.remaining} s.
						</Alert>
					)}

					<Button type="submit" size="md" fullWidth loading={isLoading} disabled={cooldown.active}>
						Create account
					</Button>

					<Center>{backToSignIn}</Center>
				</Stack>
			</form>
		</AuthLayout>
	);
};
