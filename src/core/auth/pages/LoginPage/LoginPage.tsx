import React, { useState } from 'react';

import {
	Alert,
	Anchor,
	Box,
	Button,
	Center,
	Container,
	Flex,
	Group,
	Loader,
	SegmentedControl,
	Stack,
	Text,
	Title,
} from '@mantine/core';
import { LuArrowRight, LuTriangleAlert } from 'react-icons/lu';
import { useLocation, useNavigate } from 'react-router';

import { config } from '@config/config';

import { AUTH_ANONYMOUS_TOKEN } from '@core/auth/auth.constants';
import { readReturnTo } from '@core/auth/auth.utils';
import { LoginForm } from '@core/auth/components/LoginForm';
import { LoginHero } from '@core/auth/components/LoginHero';
import { OAuthLoginPanel } from '@core/auth/components/OAuthLoginPanel';
import type { LoginDto } from '@core/auth/dto';
import { useGetAuthConfigQuery, useVerifyApiTokenMutation } from '@core/auth/hooks';
import { startOAuthLogin } from '@core/auth/oauth';
import { setApiKeySession } from '@core/auth/store';
import type { AuthMethod } from '@core/auth/types/AuthMethod';
import { LocalKVStore } from '@core/localKVStore';
import { useCoreDispatch } from '@core/store';

import { BrandMark } from '@common/component/BrandMark';

import classes from './LoginPage.module.scss';

const prefStore = new LocalKVStore('auth-pref');
const METHOD_PREF_KEY = 'method';

const METHOD_OPTIONS: { value: AuthMethod; label: string }[] = [
	{ value: 'oauth', label: 'SSO' },
	{ value: 'apiKey', label: 'API Key' },
];

const SUBTITLE: Record<AuthMethod, string> = {
	oauth: 'Sign in with your organization account',
	apiKey: 'Enter your API key',
};

export const LoginPage: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const dispatch = useCoreDispatch();
	const returnTo = readReturnTo(location.state);
	const { BEELINE_UI_NAME, BEELINE_UI_ORG_URL: orgUrl } = config.value;
	const copyrightHolder = `${BEELINE_UI_NAME || 'Beeline'} And Contributors`;

	const { data: authConfig, isLoading: isConfigLoading, isError: isConfigError } = useGetAuthConfigQuery();
	const [verifyApiToken, { isLoading: isVerifying }] = useVerifyApiTokenMutation();
	const [preferredMethod, setPreferredMethod] = useState(() => prefStore.get<AuthMethod>(METHOD_PREF_KEY));
	const [apiKeyError, setApiKeyError] = useState<string | null>(null);
	const [oauthError, setOAuthError] = useState<string | null>(null);
	const [isRedirecting, setIsRedirecting] = useState(false);

	// An engine without /v1/auth/config predates SSO, so the API key is the only way in.
	const methods = METHOD_OPTIONS.filter(({ value }) => {
		if (isConfigError || !authConfig) return value === 'apiKey';
		return value === 'oauth' ? authConfig.enabled : authConfig.api_token_enabled;
	});
	const activeMethod = methods.find(({ value }) => value === preferredMethod)?.value ?? methods[0]?.value;

	const handleMethodChange = (value: string) => {
		setPreferredMethod(prefStore.set(METHOD_PREF_KEY, value as AuthMethod));
	};

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
				{methods.length > 1 && (
					<SegmentedControl fullWidth data={methods} value={activeMethod} onChange={handleMethodChange} />
				)}

				{activeMethod === 'oauth' ? (
					<OAuthLoginPanel loading={isRedirecting} error={oauthError} onStart={handleOAuthStart} />
				) : (
					<LoginForm loading={isVerifying} error={apiKeyError} onSubmit={handleApiKeySubmit} />
				)}
			</Stack>
		);
	};

	return (
		<Flex p={{ base: 'md', md: 'lg' }} gap="lg" className={classes.root}>
			<Stack flex={1} gap="xl" className={classes.panel}>
				<Box hiddenFrom="md">
					<BrandMark size={40} />
				</Box>

				<Container size={420} w="100%" flex={1} px={0}>
					<Flex className={classes.formWrapper}>
						<Box className={classes.form}>
							<Title order={1} className={classes.title}>
								Welcome Back
							</Title>
							<Text c="dimmed" fz="sm" className={classes.subtitle}>
								{activeMethod ? SUBTITLE[activeMethod] : 'Sign in to continue'}
							</Text>

							<Box className={classes.body}>{renderBody()}</Box>
						</Box>
					</Flex>
				</Container>

				<Group justify="space-between" wrap="wrap" gap="xs">
					<Text fz="xs" c="dimmed">
						Copyright &copy; 2026{' '}
						{orgUrl ? (
							<Anchor fz={'xs'} target="_blank" href={orgUrl}>
								{copyrightHolder}
							</Anchor>
						) : (
							copyrightHolder
						)}
					</Text>
				</Group>
			</Stack>

			<Box flex={1} visibleFrom="md">
				<LoginHero />
			</Box>
		</Flex>
	);
};
