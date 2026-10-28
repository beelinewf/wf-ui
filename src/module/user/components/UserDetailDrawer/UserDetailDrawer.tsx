import React from 'react';

import {
	ActionIcon,
	Alert,
	Avatar,
	Badge,
	CopyButton,
	Divider,
	Drawer,
	Group,
	Loader,
	Stack,
	Text,
	Tooltip,
} from '@mantine/core';
import { skipToken } from '@reduxjs/toolkit/query';
import dayjs from 'dayjs';
import { LuCheck, LuCircleAlert, LuCopy, LuInfo } from 'react-icons/lu';

import { useGetUserQuery } from '@module/user/hooks';
import type { User } from '@module/user/types/User';
import { isSystemUser, userDisplayName } from '@module/user/utils';

interface UserDetailDrawerProps {
	/** The row the drawer was opened from; it is shown until the detail request lands. `null` closes it. */
	user: User | null;
	onClose: () => void;
}

const formatTime = (value: string) => dayjs(value).format('DD MMM YYYY HH:mm');

const IdentityField: React.FC<{ label: string; value: string | null | undefined; copyable?: boolean }> = ({
	label,
	value,
	copyable,
}) => (
	<div>
		<Text fz="xs" c="dimmed">
			{label}
		</Text>
		<Group gap={4} wrap="nowrap">
			<Text fz="sm" ff="monospace" c={value ? undefined : 'dimmed'} style={{ wordBreak: 'break-all' }}>
				{value || 'None'}
			</Text>
			{copyable && value && (
				<CopyButton value={value} timeout={1500}>
					{({ copied, copy }) => (
						<Tooltip label={copied ? 'Copied' : `Copy ${label.toLowerCase()}`}>
							<ActionIcon
								variant="subtle"
								size="sm"
								color={copied ? 'teal' : 'gray'}
								onClick={copy}
								aria-label={`Copy ${label.toLowerCase()}`}
							>
								{copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
							</ActionIcon>
						</Tooltip>
					)}
				</CopyButton>
			)}
		</Group>
	</div>
);

export const UserDetailDrawer: React.FC<UserDetailDrawerProps> = ({ user, onClose }) => {
	const { data, isFetching, isError } = useGetUserQuery(user?.id ?? skipToken);
	const detail = data && data.id === user?.id ? data : user;

	return (
		<Drawer
			opened={!!user}
			onClose={onClose}
			position="right"
			size="md"
			title={
				<Group gap="xs">
					<Text fw={600}>User</Text>
					{isFetching && <Loader size={14} color="gray" />}
				</Group>
			}
		>
			{detail && (
				<Stack gap="md">
					<Group gap="sm" wrap="nowrap">
						<Avatar radius="xl" size="lg" color="initials" name={userDisplayName(detail)} />
						<div style={{ minWidth: 0 }}>
							<Group gap={6}>
								<Text fw={600}>{userDisplayName(detail)}</Text>
								{isSystemUser(detail) && (
									<Badge size="sm" variant="light" color="gray">
										System
									</Badge>
								)}
							</Group>
							<Text fz="sm" c="dimmed" truncate>
								{detail.email || 'No email'}
							</Text>
						</div>
					</Group>

					{isError && (
						<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="xs">
							Couldn't refresh this user; showing the list entry.
						</Alert>
					)}

					<Divider label="Identity" labelPosition="left" />
					<Stack gap="sm">
						<IdentityField label="User id" value={detail.id} copyable />
						<IdentityField label="Subject" value={detail.subject} copyable />
						<IdentityField label="Issuer" value={detail.issuer} />
					</Stack>

					<Alert color="blue" variant="light" icon={<LuInfo size={16} />} p="xs">
						<Text fz="sm">
							Roles aren't stored on the user. They're read from the identity provider's token each time
							the user signs in.
						</Text>
					</Alert>

					<Divider />
					<Group gap="xl">
						<div>
							<Text fz="xs" c="dimmed">
								Joined
							</Text>
							<Text fz="sm">{formatTime(detail.created_at)}</Text>
						</div>
						<div>
							<Text fz="xs" c="dimmed">
								Updated
							</Text>
							<Text fz="sm">{formatTime(detail.updated_at)}</Text>
						</div>
					</Group>
				</Stack>
			)}
		</Drawer>
	);
};
