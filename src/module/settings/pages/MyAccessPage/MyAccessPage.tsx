import React from 'react';

import { Alert, Avatar, Badge, Button, Divider, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core';
import { LuCircleAlert, LuInfo, LuShieldAlert } from 'react-icons/lu';

import { useGetMeQuery } from '@core/auth/hooks';
import { selectAuthMethod, selectIsAnonymous } from '@core/auth/store';
import { useCoreSelector } from '@core/store';

import { PermissionList } from '@module/role/components/PermissionList';

export const MyAccessPage: React.FC = () => {
	const isAnonymous = useCoreSelector(selectIsAnonymous);
	// Shares the cache entry the authorization gates read, so this is the same identity they act on.
	const { data: me, isError, isFetching, refetch } = useGetMeQuery(undefined, { skip: isAnonymous });
	// Local accounts can only sign in over the email login, so the session method says exactly who can self-edit.
	const isLocal = useCoreSelector(selectAuthMethod) === 'local';

	const renderBody = () => {
		if (isAnonymous) {
			return (
				<Alert color="blue" variant="light" icon={<LuInfo size={16} />}>
					Authentication is turned off on this engine, so every action is allowed and there are no roles to
					show.
				</Alert>
			);
		}

		if (isError && !me) {
			return (
				<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} title="Couldn't load your access">
					<Button size="xs" variant="light" color="red" mt={4} loading={isFetching} onClick={refetch}>
						Try again
					</Button>
				</Alert>
			);
		}

		if (!me) {
			return (
				<Stack gap="sm">
					<Group gap="sm">
						<Skeleton circle height={40} />
						<Stack gap={6}>
							<Skeleton height={12} width={160} />
							<Skeleton height={10} width={200} />
						</Stack>
					</Group>
					<Skeleton height={10} width="40%" />
					<Skeleton height={10} width="60%" />
				</Stack>
			);
		}

		return (
			<Stack gap="md">
				<Group gap="sm" wrap="nowrap">
					<Avatar radius="xl" color="initials" name={me.name || me.email} />
					<div>
						<Text fw={600}>{me.name || 'Unnamed user'}</Text>
						<Text fz="sm" c="dimmed">
							{me.email || 'No email'}
						</Text>
					</div>
				</Group>

				{me.service && (
					<Alert color="violet" variant="light" icon={<LuShieldAlert size={16} />} p="xs">
						<Group gap="xs">
							<Badge color="violet">Service principal (bypasses all checks)</Badge>
							<Text fz="sm">Signed in with the API token, which every gate lets through.</Text>
						</Group>
					</Alert>
				)}

				<div>
					<Text fz="xs" fw={600} c="dimmed" tt="uppercase" mb={6}>
						Roles
					</Text>
					{me.roles.length > 0 ? (
						<Group gap={6}>
							{me.roles.map((role) => (
								<Badge key={role} variant="light" tt="none" ff="monospace">
									{role}
								</Badge>
							))}
						</Group>
					) : (
						<Text fz="sm" c="dimmed">
							{isLocal
								? 'Your account has no role, so gated pages stay closed. Ask an administrator to assign one.'
								: 'Your sign-in carried no role, so gated pages stay closed. Ask an administrator to assign one in the identity provider.'}
						</Text>
					)}
				</div>

				<Divider label="Effective permissions" labelPosition="left" />
				<PermissionList permissions={me.permissions} emptyText="Your roles grant no permissions." />
			</Stack>
		);
	};

	return (
		<Paper withBorder radius="md" p="lg">
			<Stack gap="md">
				<div>
					<Title order={3} fz="md">
						My access
					</Title>
					<Text c="dimmed" fz="sm">
						{isLocal
							? 'Who the engine sees you as and what your roles let you do. An administrator assigns your roles.'
							: 'Who the engine sees you as and what your roles let you do.'}
					</Text>
				</div>
				{renderBody()}
				{me && !isLocal && !me.service && (
					<Text fz="xs" c="dimmed">
						Your profile and roles are managed by your identity provider.
					</Text>
				)}
			</Stack>
		</Paper>
	);
};
