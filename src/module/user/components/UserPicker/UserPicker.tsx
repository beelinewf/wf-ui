import React, { useState } from 'react';

import { MultiSelect, TagsInput } from '@mantine/core';

import { Permission, useCan } from '@core/auth/authorization';

import { USER_ID_PATTERN, USER_PICKER_PAGE_SIZE } from '@module/user/constant';
import { useListUsersQuery } from '@module/user/hooks';
import { shortUserId, userDisplayName } from '@module/user/utils';

interface UserPickerProps {
	/** Selected users.id uuids. */
	value: string[];
	onChange?: (ids: string[]) => void;
	label: React.ReactNode;
	description?: React.ReactNode;
	placeholder?: string;
	error?: React.ReactNode;
	readOnly?: boolean;
}

const wrapperOrder: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error'];

/**
 * Picks users by name or email from the directory, storing their ids. Without users:read it falls back to typing
 * the ids.
 */
export const UserPicker: React.FC<UserPickerProps> = ({
	value,
	onChange,
	label,
	description,
	placeholder,
	error,
	readOnly,
}) => {
	const canRead = useCan(Permission.UsersRead);
	const [search, setSearch] = useState('');

	const list = useListUsersQuery({ page: 1, perPage: USER_PICKER_PAGE_SIZE }, { skip: !canRead });

	if (!canRead) {
		const invalid = value.filter((id) => !USER_ID_PATTERN.test(id));
		return (
			<TagsInput
				label={label}
				description={description}
				inputWrapperOrder={wrapperOrder}
				placeholder={value.length === 0 ? (placeholder ?? 'User id (UUID)') : undefined}
				ff="monospace"
				readOnly={readOnly}
				value={value}
				onChange={(next) => onChange?.(next.map((id) => id.trim()).filter(Boolean))}
				acceptValueOnBlur
				splitChars={[',', ' ']}
				error={error ?? (invalid.length > 0 ? `Not a user id: ${invalid.join(', ')}` : undefined)}
			/>
		);
	}

	const users = list.data?.items ?? [];
	const data = users.map((user) => ({
		value: user.id,
		label: user.email && user.name ? `${user.name} · ${user.email}` : userDisplayName(user),
	}));
	// Keep selections outside the first page visible, labelled by id since there is no name to show.
	for (const id of value) {
		if (!data.some((item) => item.value === id)) data.push({ value: id, label: shortUserId(id) });
	}
	const pasted = search.trim();
	if (USER_ID_PATTERN.test(pasted) && !data.some((item) => item.value === pasted)) {
		data.push({ value: pasted, label: `Use id ${pasted}` });
	}
	const truncated = (list.data?.total ?? 0) > USER_PICKER_PAGE_SIZE;

	return (
		<MultiSelect
			label={label}
			description={description}
			inputWrapperOrder={wrapperOrder}
			placeholder={value.length === 0 ? (list.isLoading ? 'Loading users…' : placeholder) : undefined}
			data={data}
			searchable
			hidePickedOptions
			searchValue={search}
			onSearchChange={setSearch}
			nothingFoundMessage={
				truncated ? `Not in the first ${USER_PICKER_PAGE_SIZE} users; paste their id` : 'No user found'
			}
			readOnly={readOnly}
			value={value}
			onChange={(next) => onChange?.(next)}
			error={error}
		/>
	);
};
