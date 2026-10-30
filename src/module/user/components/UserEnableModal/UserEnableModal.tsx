import React, { useEffect } from 'react';

import { Alert, Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { LuCircleAlert } from 'react-icons/lu';

import { PasswordRequirements } from '@core/auth/components/PasswordRequirements';

import { userPasswordInitialValues, userPasswordSchema, type UserPasswordDto } from '@module/user/dto';
import type { User } from '@module/user/types/User';
import { userDisplayName } from '@module/user/utils';

interface UserEnableModalProps {
	user: User | null;
	loading: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: (user: User, password: string) => void;
}

/** Disabling clears the password, so re-enabling sets a new one in the same request. */
export const UserEnableModal: React.FC<UserEnableModalProps> = ({ user, loading, error, onClose, onConfirm }) => {
	const form = useForm<UserPasswordDto>({
		mode: 'controlled',
		initialValues: userPasswordInitialValues,
		validate: (values) => {
			const result = userPasswordSchema.safeParse(values);
			if (result.success) return {};

			return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
		},
	});

	// Reset on every open so a previous password never lingers in the form.
	useEffect(() => {
		if (!user) return;
		form.reset();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user]);

	return (
		<Modal
			opened={!!user}
			onClose={onClose}
			title="Re-enable user"
			centered
			closeOnClickOutside={!loading}
			closeOnEscape={!loading}
			withCloseButton={!loading}
		>
			<form
				onSubmit={form.onSubmit(({ password }) => {
					if (user) onConfirm(user, password);
				})}
				noValidate
			>
				<Stack gap="md">
					<Text fz="sm">
						Re-enable{' '}
						<Text span fw={600}>
							{user && userDisplayName(user)}
						</Text>
						? Their password was cleared when the account was disabled, so set a new one and share it with
						them.
					</Text>

					<Stack gap={6}>
						<PasswordInput
							label="New password"
							autoComplete="new-password"
							data-autofocus
							{...form.getInputProps('password')}
						/>
						<PasswordRequirements password={form.values.password} />
					</Stack>
					<PasswordInput
						label="Confirm password"
						autoComplete="new-password"
						{...form.getInputProps('confirmPassword')}
					/>

					{error && (
						<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />}>
							{error}
						</Alert>
					)}

					<Group justify="flex-end" gap="xs">
						<Button variant="default" onClick={onClose} disabled={loading}>
							Cancel
						</Button>
						<Button type="submit" loading={loading}>
							Re-enable
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
};
