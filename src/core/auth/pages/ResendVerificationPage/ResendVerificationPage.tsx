import React, { useState } from 'react';

import { Anchor, Center, Stack, Text, TextInput } from '@mantine/core';
import { LuArrowLeft } from 'react-icons/lu';
import { Link, useLocation } from 'react-router';

import { AUTH_LOGIN_PATH } from '@core/auth/auth.constants';
import { AuthLayout } from '@core/auth/components/AuthLayout';
import { ResendVerificationButton } from '@core/auth/components/ResendVerificationButton';
import { emailSchema } from '@core/auth/dto';

export const ResendVerificationPage: React.FC = () => {
	const location = useLocation();
	const [email, setEmail] = useState('');
	const valid = emailSchema.safeParse(email).success;

	return (
		<AuthLayout
			title="Resend verification"
			subtitle="Enter the email you registered with and we'll send a new link"
		>
			<Stack gap="md">
				<TextInput
					label="Email"
					placeholder="you@example.com"
					type="email"
					size="md"
					autoComplete="email"
					data-autofocus
					value={email}
					onChange={(event) => setEmail(event.currentTarget.value)}
				/>
				{/* The button only enables for a well-formed address; the server's reply is the same for any. */}
				<ResendVerificationButton
					email={valid ? email : ''}
					size="md"
					fullWidth
					label="Send verification email"
				/>
				<Text fz="xs" c="dimmed">
					If an account is waiting for verification at that address, a new link arrives in a minute or two.
				</Text>
				<Center>
					<Anchor component={Link} to={AUTH_LOGIN_PATH} state={location.state} fz="sm">
						<Text span inherit display="inline-flex" style={{ alignItems: 'center', gap: 4 }}>
							<LuArrowLeft size={14} aria-hidden />
							Back to sign in
						</Text>
					</Anchor>
				</Center>
			</Stack>
		</AuthLayout>
	);
};
