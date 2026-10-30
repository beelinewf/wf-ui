import React from 'react';

import { Badge, Checkbox, Group, Paper, Stack, Text } from '@mantine/core';
import { LuTriangleAlert } from 'react-icons/lu';

import { PERMISSION_GROUPS, PERMISSION_META } from '@module/role/constant';
import { unrecognizedPermissions } from '@module/role/utils';

interface RolePermissionPickerProps {
	value: string[];
	onChange: (value: string[]) => void;
	/** While the role holds `*`, every box reads as granted and none can be changed. */
	disabled?: boolean;
}

/** One card per resource group: a checkbox per permission, select-all on the group, and an "n of m" count. */
export const RolePermissionPicker: React.FC<RolePermissionPickerProps> = ({ value, onChange, disabled }) => {
	const granted = new Set(value);
	const unknown = unrecognizedPermissions(value);

	const toggle = (permission: string, checked: boolean) =>
		onChange(checked ? [...value, permission] : value.filter((item) => item !== permission));

	const toggleGroup = (permissions: string[], checked: boolean) => {
		const rest = value.filter((item) => !permissions.includes(item));
		onChange(checked ? [...rest, ...permissions] : rest);
	};

	return (
		<Stack gap="sm">
			<Stack gap="sm">
				{PERMISSION_GROUPS.map((group) => {
					const count = disabled
						? group.permissions.length
						: group.permissions.filter((permission) => granted.has(permission)).length;
					const all = count === group.permissions.length;

					return (
						<Paper key={group.id} withBorder radius="md" p="sm">
							<Group justify="space-between" mb="xs" wrap="nowrap">
								<Checkbox
									label={
										<Text fz="sm" fw={600}>
											{group.label}
										</Text>
									}
									checked={all}
									indeterminate={count > 0 && !all}
									disabled={disabled}
									onChange={(event) => toggleGroup(group.permissions, event.currentTarget.checked)}
									aria-label={`Select all ${group.label} permissions`}
								/>
								<Text fz="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
									{count} of {group.permissions.length}
								</Text>
							</Group>
							<Stack gap={6} pl="lg">
								{group.permissions.map((permission) => (
									<Checkbox
										key={permission}
										size="xs"
										checked={disabled || granted.has(permission)}
										disabled={disabled}
										onChange={(event) => toggle(permission, event.currentTarget.checked)}
										label={
											<>
												<Text fz="sm" lh={1.3}>
													{PERMISSION_META[permission].label}
												</Text>
												<Text fz="xs" c="dimmed" ff="monospace">
													{permission}
												</Text>
											</>
										}
									/>
								))}
							</Stack>
						</Paper>
					);
				})}
			</Stack>

			{unknown.length > 0 && (
				<Paper withBorder radius="md" p="sm">
					<Group gap={6} mb={4}>
						<LuTriangleAlert size={14} color="var(--mantine-color-yellow-7)" aria-hidden />
						<Text fz="sm" fw={600}>
							Unrecognized
						</Text>
					</Group>
					<Text fz="xs" c="dimmed" mb="xs">
						The role grants these but this UI doesn't know them. They're kept on save unless you untick
						them.
					</Text>
					<Group gap="xs">
						{unknown.map((permission) => (
							<Checkbox
								key={permission}
								size="xs"
								checked
								disabled={disabled}
								onChange={() => toggle(permission, false)}
								label={
									<Badge color="yellow" variant="light" tt="none" ff="monospace">
										{permission}
									</Badge>
								}
							/>
						))}
					</Group>
				</Paper>
			)}
		</Stack>
	);
};
