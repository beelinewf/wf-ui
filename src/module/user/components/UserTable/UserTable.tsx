import React from 'react';

import { ActionIcon, Avatar, Badge, Card, CopyButton, Group, Skeleton, Table, Text, Tooltip } from '@mantine/core';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LuCheck, LuCopy } from 'react-icons/lu';

import type { User } from '@module/user/types/User';
import { isSystemUser, issuerLabel, userDisplayName } from '@module/user/utils';

import classes from './UserTable.module.scss';

dayjs.extend(relativeTime);

const COLUMN_COUNT = 5;

interface UserTableProps {
	users: User[];
	onSelect: (user: User) => void;
	skeletonRows?: number;
}

const TimeCell: React.FC<{ value: string }> = ({ value }) => (
	<Tooltip label={dayjs(value).format('DD MMM YYYY HH:mm:ss')}>
		<Text fz="sm" c="dimmed" className={classes.nowrap}>
			{dayjs(value).fromNow()}
		</Text>
	</Tooltip>
);

export const UserTable: React.FC<UserTableProps> = ({ users, onSelect, skeletonRows }) => {
	return (
		<Card padding={0} className={classes.root}>
			<Table.ScrollContainer minWidth={720} type="native">
				<Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md" fz="sm">
					<Table.Thead className={classes.head}>
						<Table.Tr>
							<Table.Th>User</Table.Th>
							<Table.Th>Identity provider</Table.Th>
							<Table.Th>Joined</Table.Th>
							<Table.Th>Updated</Table.Th>
							<Table.Th w={56} />
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
									<Table.Tr key={user.id} className={classes.row} onClick={() => onSelect(user)}>
										<Table.Td>
											<Group gap="sm" wrap="nowrap">
												<Avatar
													size={32}
													radius="xl"
													color="initials"
													name={userDisplayName(user)}
												/>
												<div style={{ minWidth: 0 }}>
													<Text fz="sm" fw={600} truncate maw={280}>
														{userDisplayName(user)}
													</Text>
													<Text fz="xs" c="dimmed" truncate maw={280}>
														{user.email || 'No email'}
													</Text>
												</div>
											</Group>
										</Table.Td>
										<Table.Td>
											{isSystemUser(user) ? (
												<Badge size="sm" variant="light" color="gray">
													System
												</Badge>
											) : (
												<Text
													fz="sm"
													c="dimmed"
													truncate
													maw={220}
													title={user.issuer ?? undefined}
												>
													{user.issuer ? issuerLabel(user.issuer) : '—'}
												</Text>
											)}
										</Table.Td>
										<Table.Td>
											<TimeCell value={user.created_at} />
										</Table.Td>
										<Table.Td>
											<TimeCell value={user.updated_at} />
										</Table.Td>
										<Table.Td>
											<Group justify="flex-end" wrap="nowrap">
												<CopyButton value={user.id} timeout={1500}>
													{({ copied, copy }) => (
														<Tooltip label={copied ? 'Copied' : 'Copy user id'}>
															<ActionIcon
																variant="subtle"
																color={copied ? 'teal' : 'gray'}
																onClick={(event) => {
																	event.stopPropagation();
																	copy();
																}}
																aria-label={`Copy id of ${userDisplayName(user)}`}
															>
																{copied ? <LuCheck size={16} /> : <LuCopy size={16} />}
															</ActionIcon>
														</Tooltip>
													)}
												</CopyButton>
											</Group>
										</Table.Td>
									</Table.Tr>
								))}
					</Table.Tbody>
				</Table>
			</Table.ScrollContainer>
		</Card>
	);
};
