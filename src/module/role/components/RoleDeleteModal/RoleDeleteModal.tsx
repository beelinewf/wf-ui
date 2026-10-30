import React, { useState } from 'react';

import { Alert, Button, Group, Modal, Stack, Text, TextInput } from '@mantine/core';
import { LuCircleAlert } from 'react-icons/lu';

import type { Role } from '@module/role/types/Role';

interface RoleDeleteModalProps {
	role: Role | null;
	loading: boolean;
	error: string | null;
	onClose: () => void;
	onConfirm: (role: Role) => void;
}

/** Typing the name to confirm, since users holding the role lose its grants at once. */
export const RoleDeleteModal: React.FC<RoleDeleteModalProps> = ({ role, loading, error, onClose, onConfirm }) => {
	// Tied to the role it was typed for, so reopening the modal (for any role) starts empty.
	const [entry, setEntry] = useState({ role: null as Role | null, value: '' });
	const typed = entry.role === role ? entry.value : '';

	const matches = !!role && typed === role.name;

	return (
		<Modal
			opened={!!role}
			onClose={onClose}
			title="Delete role"
			centered
			closeOnClickOutside={!loading}
			closeOnEscape={!loading}
			withCloseButton={!loading}
		>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (role && matches) onConfirm(role);
				}}
			>
				<Stack gap="md">
					<Text fz="sm">
						Delete{' '}
						<Text span fw={600} ff="monospace">
							{role?.name}
						</Text>
						? Users holding this role lose its permissions immediately. Tokens and input nodes that name it
						keep the name, but it grants nothing. This cannot be undone.
					</Text>

					<TextInput
						label={
							<>
								Type{' '}
								<Text span ff="monospace" fw={600} fz="sm">
									{role?.name}
								</Text>{' '}
								to confirm
							</>
						}
						value={typed}
						onChange={(event) => setEntry({ role, value: event.currentTarget.value })}
						autoComplete="off"
						spellCheck={false}
						data-autofocus
						styles={{
							input: { fontFamily: 'var(--mantine-font-family-monospace)' },
						}}
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
						<Button type="submit" color="red" loading={loading} disabled={!matches}>
							Delete role
						</Button>
					</Group>
				</Stack>
			</form>
		</Modal>
	);
};
