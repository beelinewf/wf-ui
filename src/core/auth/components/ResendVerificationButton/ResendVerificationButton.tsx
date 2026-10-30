import React, { useState } from 'react';

import { Button, type ButtonProps, Stack, Text } from '@mantine/core';
import { LuMailCheck } from 'react-icons/lu';

import { queryErrorMessage, queryRetryAfter } from '@core/api';
import { RESEND_COOLDOWN_SECONDS } from '@core/auth/auth.constants';
import { useResendVerificationMutation } from '@core/auth/hooks';

import { useCooldown } from '@common/hooks/useCooldown';

interface ResendVerificationButtonProps extends Omit<ButtonProps, 'onClick' | 'loading' | 'disabled'> {
	email: string;
	label?: string;
}

/**
 * Sends a fresh verification link, then holds off for a cooldown (or the server's Retry-After). The server answers
 * every email the same, so the confirmation never says whether an account exists.
 */
export const ResendVerificationButton: React.FC<ResendVerificationButtonProps> = ({
	email,
	label = 'Resend verification email',
	...buttonProps
}) => {
	const [resend, { isLoading }] = useResendVerificationMutation();
	const cooldown = useCooldown();
	const [message, setMessage] = useState<{ tone: 'ok' | 'error' | 'limited'; text: string } | null>(null);

	const handleClick = async () => {
		setMessage(null);
		try {
			const result = await resend({ email: email.trim() }).unwrap();
			setMessage({ tone: 'ok', text: result.message });
			cooldown.start(RESEND_COOLDOWN_SECONDS);
		} catch (error) {
			const wait = queryRetryAfter(error);
			if (wait) {
				cooldown.start(wait);
				setMessage({ tone: 'limited', text: '' });
			} else {
				setMessage({ tone: 'error', text: queryErrorMessage(error, "Couldn't send the email") });
			}
		}
	};

	return (
		<Stack gap={6}>
			<Button
				variant="light"
				leftSection={<LuMailCheck size={16} />}
				{...buttonProps}
				loading={isLoading}
				disabled={!email.trim() || cooldown.active}
				onClick={handleClick}
			>
				{cooldown.active ? `${label} (${cooldown.remaining} s)` : label}
			</Button>
			{message && (message.tone !== 'limited' || cooldown.active) && (
				<Text fz="xs" c={message.tone === 'ok' ? 'teal.7' : 'red.7'} aria-live="polite">
					{message.tone === 'limited'
						? `Too many attempts, try again in ${cooldown.remaining} s.`
						: message.text}
				</Text>
			)}
		</Stack>
	);
};
