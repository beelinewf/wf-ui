import React, { useState } from 'react';

import { Alert, Badge, Button, Group, Modal, Paper, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuCircleAlert, LuMailWarning } from 'react-icons/lu';

import { queryErrorCode, queryErrorMessage } from '@core/api';
import { useGetAuthConfigQuery } from '@core/auth/hooks';
import type { AuthMe } from '@core/auth/types/AuthMe';

import { useNotify } from '@module/notification/hooks';
import { myProfileSchema, type MyProfileDto } from '@module/settings/dto';
import { useUpdateUserMutation } from '@module/user/hooks';

interface MyProfileCardProps {
	me: AuthMe;
	/** From GET /v1/users/{id}, which needs users:read; unknown otherwise. */
	emailVerified?: boolean;
}

export const MyProfileCard: React.FC<MyProfileCardProps> = ({ me, emailVerified }) => {
	const { data: authConfig } = useGetAuthConfigQuery();
	const [updateUser, { isLoading }] = useUpdateUserMutation();
	const notify = useNotify();
	const [error, setError] = useState<string | null>(null);
	const [confirmEmail, setConfirmEmail] = useState<MyProfileDto | null>(null);
	const verificationEnabled = !!authConfig?.email_verification_enabled;

	const form = useForm<MyProfileDto>({
		mode: 'controlled',
		initialValues: { name: me.name, email: me.email },
		validate: (values) => {
			const result = myProfileSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	const emailChanged = (values: MyProfileDto) => values.email.trim().toLowerCase() !== me.email.toLowerCase();

	const save = async (values: MyProfileDto) => {
		setError(null);
		const name = values.name.trim();
		const email = values.email.trim();
		try {
			await updateUser({
				id: me.id,
				self: true,
				payload: {
					...(name !== me.name ? { name } : {}),
					...(emailChanged(values) ? { email } : {}),
				},
			}).unwrap();
			form.resetDirty({ name, email });
			notify.success({ title: 'Profile saved', message: 'Your profile was updated' });
		} catch (err) {
			if (queryErrorCode(err) === 409) form.setFieldError('email', 'An account with this email already exists');
			else setError(queryErrorMessage(err, "Couldn't save your profile"));
		}
	};

	const handleSubmit = async (values: MyProfileDto) => {
		if (verificationEnabled && emailChanged(values)) {
			setConfirmEmail(values);
			return;
		}
		await save(values);
	};

	return (
		<Paper withBorder radius="md" p="lg">
			<form onSubmit={form.onSubmit(handleSubmit)} noValidate>
				<Stack gap="md">
					<div>
						<Title order={3} fz="md">
							Profile
						</Title>
						<Text c="dimmed" fz="sm">
							Your name and the email you sign in with.
						</Text>
					</div>

					<TextInput label="Name" autoComplete="name" {...form.getInputProps('name')} />
					<TextInput
						label={
							<Group gap={6} component="span" display="inline-flex">
								Email
								{emailVerified === false && (
									<Badge size="xs" color="yellow" variant="light">
										Not verified
									</Badge>
								)}
							</Group>
						}
						type="email"
						autoComplete="email"
						{...form.getInputProps('email')}
					/>

					{error && (
						<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />}>
							{error}
						</Alert>
					)}

					<Group justify="flex-end">
						<Button type="submit" loading={isLoading} disabled={!form.isDirty()}>
							Save profile
						</Button>
					</Group>
				</Stack>
			</form>

			<Modal opened={!!confirmEmail} onClose={() => setConfirmEmail(null)} title="Change your email?" centered>
				<Stack gap="md">
					<Alert color="yellow" variant="light" icon={<LuMailWarning size={16} />}>
						We'll send a verification link to{' '}
						<Text span fw={600} fz="sm">
							{confirmEmail?.email.trim()}
						</Text>
						. You must open it before your next sign-in, which will use the new address.
					</Alert>
					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={() => setConfirmEmail(null)}>
							Cancel
						</Button>
						<Button
							loading={isLoading}
							onClick={async () => {
								const values = confirmEmail;
								setConfirmEmail(null);
								if (values) await save(values);
							}}
						>
							Change email
						</Button>
					</Group>
				</Stack>
			</Modal>
		</Paper>
	);
};
