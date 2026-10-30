import React, { useState } from 'react';

import { Alert, Button, Center, Loader, SegmentedControl, Stack } from '@mantine/core';
import { LuArrowRight, LuClock } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router';

import { AUTH_ANONYMOUS_TOKEN } from '@core/auth/auth.constants';
import { readReturnTo } from '@core/auth/auth.utils';
import { AuthLayout } from '@core/auth/components/AuthLayout';
import { LocalLoginForm } from '@core/auth/components/LocalLoginForm';
import { LoginForm } from '@core/auth/components/LoginForm';
import { OAuthLoginPanel } from '@core/auth/components/OAuthLoginPanel';
import type { LoginDto } from '@core/auth/dto';
import { useGetAuthConfigQuery, useVerifyApiTokenMutation } from '@core/auth/hooks';
import { startOAuthLogin } from '@core/auth/oauth';
import { dismissSessionExpired, selectSessionExpired, setApiKeySession } from '@core/auth/store';
import type { AuthConfig } from '@core/auth/types/AuthConfig';
import type { AuthMethod } from '@core/auth/types/AuthMethod';
import { LocalKVStore } from '@core/localKVStore';
import { useCoreDispatch, useCoreSelector } from '@core/store';

const prefStore = new LocalKVStore('auth-pref');
const METHOD_PREF_KEY = 'method';

// Email first: for an organization without SSO it may be the only way in.
const METHOD_OPTIONS: { value: AuthMethod; label: string }[] = [
	{ value: 'local', label: 'Email' },
	{ value: 'oauth', label: 'SSO' },
	{ value: 'apiKey', label: 'API Key' },
];

const SUBTITLE: Record<AuthMethod, string> = {
	local: 'Sign in with your email and password',
	oauth: 'Sign in with your organization account',
	apiKey: 'Enter your API key',
};

const isMethodEnabled = (method: AuthMethod, authConfig: AuthConfig) => {
	if (method === 'local') return authConfig.local_enabled;
	if (method === 'oauth') return authConfig.enabled;
	return authConfig.api_token_enabled;
};

export const LoginPage: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useCoreDispatch();
	const returnTo = readReturnTo(location.state);
	const sessionExpired = useCoreSelector(selectSessionExpired);

	const { data: authConfig, isLoading: isConfigLoading, isError: isConfigError } = useGetAuthConfigQuery();
	const [verifyApiToken, { isLoading: isVerifying }] = useVerifyApiTokenMutation();
	const [preferredMethod, setPreferredMethod] = useState(() => prefStore.get<AuthMethod>(METHOD_PREF_KEY));
	const [apiKeyError, setApiKeyError] = useState<string | null>(null);
	const [oauthError, setOAuthError] = useState<string | null>(null);
	const [isRedirecting, setIsRedirecting] = useState(false);

	// An engine without /v1/auth/config predates SSO, so the API key is the only way in.
	const methods = METHOD_OPTIONS.filter(({ value }) => {
		if (isConfigError || !authConfig) return value === 'apiKey';
		return isMethodEnabled(value, authConfig);
	});
	// The remembered choice wins while it is still offered.
	const activeMethod = methods.find(({ value }) => value === preferredMethod)?.value ?? methods[0]?.value;

	const handleMethodChange = (value: string) => {
		setPreferredMethod(prefStore.set(METHOD_PREF_KEY, value as AuthMethod));
	};

	const handleSignedIn = () => navigate(returnTo, { replace: true });

	const handleApiKeySubmit = async ({ apiKey }: LoginDto) => {
		setApiKeyError(null);
		const result = await verifyApiToken(apiKey);

		if ('error' in result && result.error) {
			const code = 'code' in result.error ? result.error.code : 0;
			setApiKeyError(code === 401 || code === 403 ? 'Invalid API key' : 'Unable to reach the workflow engine');
			return;
		}

		dispatch(setApiKeySession(apiKey));
		navigate(returnTo, { replace: true });
	};

	// With no login method the engine is open, so a placeholder key just satisfies the app's session guard.
	const handleOpenAccess = () => {
		dispatch(setApiKeySession(AUTH_ANONYMOUS_TOKEN));
		navigate(returnTo, { replace: true });
	};

	const handleOAuthStart = async () => {
		if (!authConfig) return;
		setOAuthError(null);
		setIsRedirecting(true);

		try {
			window.location.assign(await startOAuthLogin(authConfig, returnTo));
		} catch (err) {
			setIsRedirecting(false);
			setOAuthError(err instanceof Error ? err.message : 'Unable to start SSO login');
		}
	};

	const renderMethod = () => {
		if (activeMethod === 'local' && authConfig) {
			return <LocalLoginForm authConfig={authConfig} onSignedIn={handleSignedIn} />;
		}
		if (activeMethod === 'oauth') {
			return <OAuthLoginPanel loading={isRedirecting} error={oauthError} onStart={handleOAuthStart} />;
		}
		return <LoginForm loading={isVerifying} error={apiKeyError} onSubmit={handleApiKeySubmit} />;
	};

	const renderBody = () => {
		if (isConfigLoading) {
			return (
				<Center py="xl">
					<Loader size="sm" />
				</Center>
			);
		}

		if (!activeMethod) {
			return (
				<Stack gap="md">
					<Button size="md" fullWidth leftSection={<LuArrowRight size={18} />} onClick={handleOpenAccess}>
						Go to app
					</Button>
				</Stack>
			);
		}

		return (
			<Stack gap="lg">
				{sessionExpired && (
					<Alert
						variant="light"
						color="blue"
						icon={<LuClock size={16} aria-hidden />}
						withCloseButton
						onClose={() => dispatch(dismissSessionExpired())}
					>
						Your session expired, sign in again.
					</Alert>
				)}

				{methods.length > 1 && (
					<SegmentedControl fullWidth data={methods} value={activeMethod} onChange={handleMethodChange} />
				)}

				{renderMethod()}
			</Stack>
		);
	};

	return (
		<AuthLayout title="Welcome Back" subtitle={activeMethod ? SUBTITLE[activeMethod] : 'Sign in to continue'}>
			{renderBody()}
		</AuthLayout>
	);
};
