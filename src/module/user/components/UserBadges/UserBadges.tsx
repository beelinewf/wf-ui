import React from 'react';

import { Badge, Group, Text, Tooltip } from '@mantine/core';

import { USER_SOURCE_META, USER_STATUS_META } from '@module/user/constant';
import type { User } from '@module/user/types/User';
import { issuerLabel, userSource, userStatus } from '@module/user/utils';

export const UserSourceBadge: React.FC<{ user: User }> = ({ user }) => {
	const source = userSource(user);
	const meta = USER_SOURCE_META[source];
	const badge = (
		<Badge size="sm" variant="light" color={meta.color}>
			{meta.label}
		</Badge>
	);
	// The SSO badge names the provider on hover, as the old issuer column did.
	return source === 'sso' && user.issuer ? <Tooltip label={issuerLabel(user.issuer)}>{badge}</Tooltip> : badge;
};

export const UserStatusBadge: React.FC<{ user: User }> = ({ user }) => {
	const meta = USER_STATUS_META[userStatus(user)];
	return (
		<Badge size="sm" variant="dot" color={meta.color}>
			{meta.label}
		</Badge>
	);
};

/** Local users' stored roles; OIDC users carry theirs on the live token, so there is nothing stored to show. */
export const UserRoles: React.FC<{ user: User; max?: number }> = ({ user, max }) => {
	if (!user.is_local) {
		return (
			<Text fz="xs" c="dimmed">
				{userSource(user) === 'system' ? '—' : 'From SSO'}
			</Text>
		);
	}
	if (user.roles.length === 0) {
		return (
			<Text fz="xs" c="dimmed">
				No roles
			</Text>
		);
	}
	const shown = max ? user.roles.slice(0, max) : user.roles;
	const hidden = user.roles.length - shown.length;
	return (
		<Group gap={4}>
			{shown.map((role) => (
				<Badge key={role} size="sm" variant="light" color="gray" tt="none" ff="monospace">
					{role}
				</Badge>
			))}
			{hidden > 0 && (
				<Tooltip label={user.roles.slice(shown.length).join(', ')}>
					<Badge size="sm" variant="outline" color="gray">
						+{hidden}
					</Badge>
				</Tooltip>
			)}
		</Group>
	);
};
