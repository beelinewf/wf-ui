import React from 'react';

import { ActionIcon, Avatar, Card, Group, Skeleton, Table, Text, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LuPencil, LuUserCheck, LuUserX } from 'react-icons/lu';

import { UserRoles, UserSourceBadge, UserStatusBadge } from '@module/user/components/UserBadges';
import type { User } from '@module/user/types/User';
import { isEditableUser, isSystemUser, userDisplayName } from '@module/user/utils';

import classes from './UserTable.module.scss';

dayjs.extend(relativeTime);

const COLUMN_COUNT = 6;

export interface UserRowActions {
	onDisable: (user: User) => void;
	onEnable: (user: User) => void;
}

interface UserTableProps {
	users: User[];
	onSelect: (user: User) => void;
	/** The user whose panel is open, highlighted in the list. */
	selectedId?: string | null;
	/** Shows the Edit and Disable / Re-enable controls on local rows; omitted without users:write. */
	actions?: UserRowActions;
	/** The caller's own user id, whose row cannot be disabled. */
	selfId?: string;
	skeletonRows?: number;
}

const TimeCell: React.FC<{ value: string }> = ({ value }) => (
	<Tooltip label={dayjs(value).format('DD MMM YYYY HH:mm:ss')}>
		<Text fz="sm" c="dimmed" className={classes.nowrap}>
			{dayjs(value).fromNow()}
		</Text>
	</Tooltip>
);

const RowControls: React.FC<{ user: User; actions: UserRowActions; self: boolean; onEdit: () => void }> = ({
	user,
	actions,
	self,
	onEdit,
}) => (
	<Group justify="flex-end" gap={2} wrap="nowrap">
		<Tooltip label="Edit">
			<ActionIcon
				variant="subtle"
				color="gray"
				onClick={(event) => {
					event.stopPropagation();
					onEdit();
				}}
				aria-label={`Edit ${userDisplayName(user)}`}
			>
				<LuPencil size={16} />
			</ActionIcon>
		</Tooltip>
		{!self &&
			!isSystemUser(user) &&
			(user.is_active ? (
				<Tooltip label="Disable">
					<ActionIcon
						variant="subtle"
						color="red"
						onClick={(event) => {
							event.stopPropagation();
							actions.onDisable(user);
						}}
						aria-label={`Disable ${userDisplayName(user)}`}
					>
						<LuUserX size={16} />
					</ActionIcon>
				</Tooltip>
			) : (
				<Tooltip label="Re-enable">
					<ActionIcon
						variant="subtle"
						color="gray"
						onClick={(event) => {
							event.stopPropagation();
							actions.onEnable(user);
						}}
						aria-label={`Re-enable ${userDisplayName(user)}`}
					>
						<LuUserCheck size={16} />
					</ActionIcon>
				</Tooltip>
			))}
	</Group>
);

export const UserTable: React.FC<UserTableProps> = ({ users, onSelect, selectedId, actions, selfId, skeletonRows }) => {
	return (
		<Card padding={0} className={classes.root}>
			<Table.ScrollContainer minWidth={820} type="native">
				<Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" fz="sm">
					<Table.Thead className={classes.head}>
						<Table.Tr>
							<Table.Th>User</Table.Th>
							<Table.Th>Source</Table.Th>
							<Table.Th>Status</Table.Th>
							<Table.Th>Roles</Table.Th>
							<Table.Th>Joined</Table.Th>
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
							: users.map((user) => (
									<Table.Tr
										key={user.id}
										className={classes.row}
										data-disabled={!user.is_active || undefined}
										data-selected={user.id === selectedId || undefined}
										onClick={() => onSelect(user)}
									>
										<Table.Td>
											<Group gap="sm" wrap="nowrap">
												<Avatar
													size={32}
													radius="xl"
													color="initials"
													name={userDisplayName(user)}
												/>
												<div style={{ minWidth: 0 }}>
													<Text fz="sm" fw={600} truncate maw={260}>
														{userDisplayName(user)}
													</Text>
													<Text fz="xs" c="dimmed" truncate maw={260}>
														{user.email || 'No email'}
													</Text>
												</div>
											</Group>
										</Table.Td>
										<Table.Td>
											<UserSourceBadge user={user} />
										</Table.Td>
										<Table.Td>
											<UserStatusBadge user={user} />
										</Table.Td>
										<Table.Td>
											<UserRoles user={user} max={3} />
										</Table.Td>
										<Table.Td>
											<TimeCell value={user.created_at} />
										</Table.Td>
										<Table.Td>
											{actions && isEditableUser(user) && (
												<RowControls
													user={user}
													actions={actions}
													self={user.id === selfId}
													onEdit={() => onSelect(user)}
												/>
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
