import { useState } from 'react';

import { queryErrorCode, queryErrorMessage } from '@core/api';

import { useNotify } from '@module/notification/hooks';
import type { Role } from '@module/role/types/Role';

import { useDeleteRoleMutation } from './role.hooks';

/** Shared by the list, the drawer and the editor: owns the pending role, the request and its error copy. */
export const useRoleDelete = (onDeleted?: (role: Role) => void) => {
	const [pending, setPending] = useState<Role | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [deleteRole, state] = useDeleteRoleMutation();
	const notify = useNotify();

	const open = (role: Role) => {
		setError(null);
		setPending(role);
	};

	const close = () => setPending(null);

	const confirm = async (role: Role) => {
		setError(null);
		try {
			await deleteRole(role.name).unwrap();
			notify.success({
				title: 'Role deleted',
				message: `Role ${role.name} deleted`,
			});
			setPending(null);
			onDeleted?.(role);
		} catch (err) {
			const code = queryErrorCode(err);
			if (code === 404) {
				setPending(null);
				onDeleted?.(role);
			} else if (code === 409) {
				setError(queryErrorMessage(err, 'At least one role must keep the roles:write permission.'));
			} else {
				setError(queryErrorMessage(err, 'Failed to delete role'));
			}
		}
	};

	return {
		modalProps: {
			role: pending,
			loading: state.isLoading,
			error,
			onClose: close,
			onConfirm: confirm,
		},
		open,
	};
};
