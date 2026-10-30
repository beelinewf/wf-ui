import React from 'react';

import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { LuCircleAlert } from 'react-icons/lu';

import type { User } from '@module/user/types/User';
import { userDisplayName } from '@module/user/utils';

interface UserDisableModalProps {
	user: User | null;
	loading: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: (user: User) => void;
}

export const UserDisableModal: React.FC<UserDisableModalProps> = ({ user, loading, error, onClose, onConfirm }) => (
	<Modal
		opened={!!user}
		onClose={onClose}
		title="Disable user"
		centered
		closeOnClickOutside={!loading}
		closeOnEscape={!loading}
		withCloseButton={!loading}
	>
		<Stack gap="md">
			<Text fz="sm">
				Disable{' '}
				<Text span fw={600}>
					{user && userDisplayName(user)}
				</Text>
				{user?.email && <> ({user.email})</>}? Their sessions end immediately and they can't sign in until the
				account is re-enabled. Their password is cleared, so re-enabling means setting a new one. Their history
				stays.
			</Text>

			{error && (
				<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />}>
					{error}
				</Alert>
			)}

			<Group justify="flex-end" gap="xs">
				<Button variant="default" onClick={onClose} disabled={loading}>
					Cancel
				</Button>
				<Button color="red" loading={loading} onClick={() => user && onConfirm(user)}>
					Disable user
				</Button>
			</Group>
		</Stack>
	</Modal>
);
