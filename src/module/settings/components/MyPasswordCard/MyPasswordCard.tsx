import React, { useState } from 'react';

import { Alert, Button, Group, Paper, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuCircleAlert } from 'react-icons/lu';

import { queryErrorCode, queryErrorMessage } from '@core/api';
import { PasswordRequirements } from '@core/auth/components/PasswordRequirements';
import type { AuthMe } from '@core/auth/types/AuthMe';

import { useNotify } from '@module/notification/hooks';
import { myPasswordInitialValues, myPasswordSchema, type MyPasswordDto } from '@module/settings/dto';
import { useUpdateUserMutation } from '@module/user/hooks';

export const MyPasswordCard: React.FC<{ me: AuthMe }> = ({ me }) => {
	const [updateUser, { isLoading }] = useUpdateUserMutation();
	const notify = useNotify();
	const [error, setError] = useState<string | null>(null);

	const form = useForm<MyPasswordDto>({
		mode: 'controlled',
		initialValues: myPasswordInitialValues,
		validate: (values) => {
			const result = myPasswordSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	const handleSubmit = async (values: MyPasswordDto) => {
		setError(null);
		try {
			await updateUser({
				id: me.id,
				self: true,
				payload: { password: values.password, current_password: values.currentPassword },
			}).unwrap();
			form.reset();
			notify.success({ title: 'Password changed', message: 'Use your new password next time you sign in' });
		} catch (err) {
			const message = queryErrorMessage(err, "Couldn't change your password");
			// The engine answers a wrong current password with 422, as it does a weak new one; the detail tells which.
			if (queryErrorCode(err) === 422 && /current/i.test(message)) {
				form.setFieldError('currentPassword', 'Current password is incorrect');
			} else if (queryErrorCode(err) === 422) {
				form.setFieldError('password', message);
			} else {
				setError(message);
			}
		}
	};

	return (
		<Paper withBorder radius="md" p="lg">
			<form onSubmit={form.onSubmit(handleSubmit)} noValidate>
				<Stack gap="md">
					<div>
						<Title order={3} fz="md">
							Password
						</Title>
						<Text c="dimmed" fz="sm">
							Enter your current password to set a new one.
						</Text>
					</div>

					{/* Lets password managers pair the new password with this account. */}
					<input type="email" name="username" value={me.email} autoComplete="username" readOnly hidden />
					<PasswordInput
						label="Current password"
						autoComplete="current-password"
						{...form.getInputProps('currentPassword')}
					/>
					<Stack gap={6}>
						<PasswordInput
							label="New password"
							autoComplete="new-password"
							{...form.getInputProps('password')}
						/>
						<PasswordRequirements password={form.values.password} />
					</Stack>
					<PasswordInput
						label="Confirm new password"
						autoComplete="new-password"
						{...form.getInputProps('confirmPassword')}
					/>

					{error && (
						<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />}>
							{error}
						</Alert>
					)}

					<Group justify="flex-end">
						<Button type="submit" loading={isLoading}>
							Change password
						</Button>
					</Group>
				</Stack>
			</form>
		</Paper>
	);
};
