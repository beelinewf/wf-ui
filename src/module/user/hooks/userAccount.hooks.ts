import { useState } from 'react';

import { queryErrorMessage } from '@core/api';

import { useNotify } from '@module/notification/hooks';
import type { User } from '@module/user/types/User';
import { userDisplayName } from '@module/user/utils';

import { useDisableUserMutation, useResendUserVerificationMutation, useUpdateUserMutation } from './user.hooks';

/**
 * Disable, re-enable and resend for one local user at a time, shared by the list and its side panel. It owns
 * the pending users, the requests and their error copy; spread `disableModalProps` / `enableModalProps` on the modals.
 */
export const useUserAccountActions = () => {
	const [pendingDisable, setPendingDisable] = useState<User | null>(null);
	const [pendingEnable, setPendingEnable] = useState<User | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [disableUser, disableState] = useDisableUserMutation();
	const [updateUser, updateState] = useUpdateUserMutation();
	const [resendVerification] = useResendUserVerificationMutation();
	const notify = useNotify();

	const confirmDisable = async (user: User) => {
		setError(null);
		try {
			await disableUser(user.id).unwrap();
			notify.success({ title: 'User disabled', message: `${userDisplayName(user)} can no longer sign in` });
			setPendingDisable(null);
		} catch (err) {
			setError(queryErrorMessage(err, 'Failed to disable the user'));
		}
	};

	const confirmEnable = async (user: User, password: string) => {
		setError(null);
		try {
			await updateUser({ id: user.id, payload: { is_active: true, password } }).unwrap();
			notify.success({ title: 'User re-enabled', message: `${userDisplayName(user)} can sign in again` });
			setPendingEnable(null);
		} catch (err) {
			setError(queryErrorMessage(err, 'Failed to re-enable the user'));
		}
	};

	const resend = async (user: User) => {
		try {
			await resendVerification(user.id).unwrap();
			notify.success({ title: 'Verification sent', message: `A new link was sent to ${user.email}` });
		} catch (err) {
			notify.error({
				title: "Couldn't send verification",
				message: queryErrorMessage(err, 'Something went wrong'),
				toastOnly: true,
			});
		}
	};

	return {
		disable: (user: User) => {
			setError(null);
			setPendingDisable(user);
		},
		enable: (user: User) => {
			setError(null);
			setPendingEnable(user);
		},
		resend,
		disableModalProps: {
			user: pendingDisable,
			loading: disableState.isLoading,
			error,
			onClose: () => setPendingDisable(null),
			onConfirm: confirmDisable,
		},
		enableModalProps: {
			user: pendingEnable,
			loading: updateState.isLoading,
			error,
			onClose: () => setPendingEnable(null),
			onConfirm: confirmEnable,
		},
	};
};
