import React from 'react';

import { CloseButton, Group, MultiSelect, Select, TextInput } from '@mantine/core';
import { LuCircleDot, LuSearch, LuShieldCheck, LuUserRound } from 'react-icons/lu';

import type { UserSourceFilter, UserStatusFilter } from '@module/user/hooks';
import { useUserRoleOptions } from '@module/user/hooks';

export interface UserFilterValues {
	search: string;
	source: UserSourceFilter;
	status: UserStatusFilter;
	roles: string[];
}

interface UserFiltersProps {
	value: UserFilterValues;
	onChange: (value: Partial<UserFilterValues>) => void;
}

const SOURCE_OPTIONS: { value: UserSourceFilter; label: string }[] = [
	{ value: 'all', label: 'All sources' },
	{ value: 'local', label: 'Local' },
	{ value: 'sso', label: 'SSO' },
];

const STATUS_OPTIONS: { value: UserStatusFilter; label: string }[] = [
	{ value: 'all', label: 'All statuses' },
	{ value: 'active', label: 'Active' },
	{ value: 'pending', label: 'Pending verification' },
	{ value: 'disabled', label: 'Disabled' },
];

export const UserFilters: React.FC<UserFiltersProps> = ({ value, onChange }) => {
	const { options: roleOptions } = useUserRoleOptions();

	return (
		<Group gap="xs">
			<TextInput
				size="sm"
				w={240}
				aria-label="Search by name or email"
				placeholder="Name, or email with @"
				leftSection={<LuSearch size={14} />}
				value={value.search}
				onChange={(event) => onChange({ search: event.currentTarget.value })}
				rightSection={
					value.search && (
						<CloseButton size="sm" aria-label="Clear search" onClick={() => onChange({ search: '' })} />
					)
				}
			/>
			<Select
				size="sm"
				w={150}
				aria-label="Source"
				allowDeselect={false}
				leftSection={<LuUserRound size={14} />}
				data={SOURCE_OPTIONS}
				value={value.source}
				onChange={(source) => source && onChange({ source: source as UserSourceFilter })}
			/>
			<Select
				size="sm"
				w={200}
				aria-label="Status"
				allowDeselect={false}
				leftSection={<LuCircleDot size={14} />}
				data={STATUS_OPTIONS}
				value={value.status}
				onChange={(status) => status && onChange({ status: status as UserStatusFilter })}
			/>
			<MultiSelect
				size="sm"
				miw={180}
				maw={360}
				aria-label="Roles"
				placeholder={value.roles.length ? undefined : 'Any role'}
				clearable
				searchable
				leftSection={<LuShieldCheck size={14} />}
				data={roleOptions.map((role) => role.name)}
				value={value.roles}
				onChange={(roles) => onChange({ roles })}
			/>
		</Group>
	);
};
