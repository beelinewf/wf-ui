import React from 'react';

import { ActionIcon, Badge, Card, Group, Skeleton, Table, Text, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LuPencil, LuTrash2 } from 'react-icons/lu';

import { Permission } from '@core/auth/authorization';

import type { Role } from '@module/role/types/Role';
import { grantedPermissionCount, hasWildcard } from '@module/role/utils';

import classes from './RoleTable.module.scss';

dayjs.extend(relativeTime);

const COLUMN_COUNT = 4;

const PERMISSION_TOTAL = Object.values(Permission).length;

interface RoleTableProps {
	roles: Role[];
	onSelect: (role: Role) => void;
	/** The role whose panel is open, highlighted in the list. */
	selectedName?: string | null;
	/** Shows the Edit and Delete controls; omitted without roles:write. */
	onDelete?: (role: Role) => void;
	skeletonRows?: number;
}

const PermissionCell: React.FC<{ role: Role }> = ({ role }) => {
	if (hasWildcard(role.permissions)) {
		return (
			<Badge variant="light" color="grape">
				All permissions
			</Badge>
		);
	}
	const count = grantedPermissionCount(role.permissions);
	return (
		<Badge variant="light" color={count === 0 ? 'gray' : 'blue'}>
			{count} / {PERMISSION_TOTAL}
		</Badge>
	);
};

const TimeCell: React.FC<{ value: string }> = ({ value }) => (
	<Tooltip label={dayjs(value).format('DD MMM YYYY HH:mm:ss')}>
		<Text fz="sm" c="dimmed" className={classes.nowrap}>
			{dayjs(value).fromNow()}
		</Text>
	</Tooltip>
);

export const RoleTable: React.FC<RoleTableProps> = ({ roles, onSelect, selectedName, onDelete, skeletonRows }) => {
	return (
		<Card padding={0} className={classes.root}>
			<Table.ScrollContainer minWidth={720} type="native">
				<Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" fz="sm">
					<Table.Thead className={classes.head}>
						<Table.Tr>
							<Table.Th>Role name</Table.Th>
							<Table.Th>Permissions</Table.Th>
							<Table.Th>Last update</Table.Th>
							<Table.Th w={88} />
						</Table.Tr>
					</Table.Thead>
					<Table.Tbody>
						{skeletonRows
							? Array.from({ length: skeletonRows }, (_, index) => (
									<Table.Tr key={index}>
										{Array.from({ length: COLUMN_COUNT }, (_, cell) => (
											<Table.Td key={cell}>
												<Skeleton height={10} width={cell === 0 ? '70%' : '50%'} />
											</Table.Td>
										))}
									</Table.Tr>
								))
							: roles.map((role) => (
									<Table.Tr
										key={role.name}
										className={classes.row}
										data-selected={role.name === selectedName || undefined}
										onClick={() => onSelect(role)}
									>
										<Table.Td>
											<Text fz="sm" fw={600} ff="monospace" truncate maw={260}>
												{role.name}
											</Text>
											{role.description && (
												<Text fz="xs" c="dimmed" truncate maw={360}>
													{role.description}
												</Text>
											)}
										</Table.Td>
										<Table.Td>
											<PermissionCell role={role} />
										</Table.Td>
										<Table.Td>
											<TimeCell value={role.updated_at} />
										</Table.Td>
										<Table.Td>
											{onDelete && (
												<Group justify="flex-end" gap={2} wrap="nowrap">
													<Tooltip label="Edit">
														<ActionIcon
															variant="subtle"
															color="gray"
															onClick={(event) => {
																event.stopPropagation();
																onSelect(role);
															}}
															aria-label={`Edit role ${role.name}`}
														>
															<LuPencil size={16} />
														</ActionIcon>
													</Tooltip>
													<Tooltip label="Delete">
														<ActionIcon
															variant="subtle"
															color="red"
															onClick={(event) => {
																event.stopPropagation();
																onDelete(role);
															}}
															aria-label={`Delete role ${role.name}`}
														>
															<LuTrash2 size={16} />
														</ActionIcon>
													</Tooltip>
												</Group>
											)}
										</Table.Td>
									</Table.Tr>
								))}
					</Table.Tbody>
				</Table>
			</Table.ScrollContainer>
		</Card>
	);
};
