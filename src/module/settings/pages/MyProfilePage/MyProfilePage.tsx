import React from 'react';

import { Skeleton } from '@mantine/core';
import { skipToken } from '@reduxjs/toolkit/query';
import { Navigate } from 'react-router';

import { Permission, useCan } from '@core/auth/authorization';
import { useMe } from '@core/auth/hooks';
import { selectAuthMethod } from '@core/auth/store';
import { useCoreSelector } from '@core/store';

import { MyProfileCard } from '@module/settings/components/MyProfileCard';
import { useGetUserQuery } from '@module/user/hooks';

/** Name and email of a local account; anyone else's profile lives in their identity provider. */
export const MyProfilePage: React.FC = () => {
	const isLocal = useCoreSelector(selectAuthMethod) === 'local';
	const { data: me } = useMe();
	// Reading your own row still needs users:read, so the verification status is only shown when it is granted.
	const canReadUsers = useCan(Permission.UsersRead);
	const { data: ownUser } = useGetUserQuery(isLocal && canReadUsers && me ? me.id : skipToken);

	if (!isLocal) return <Navigate to="/app/settings/access" replace />;
	if (!me) return <Skeleton height={240} radius="md" />;

	return <MyProfileCard key={`${me.name}:${me.email}`} me={me} emailVerified={ownUser?.email_verified} />;
};
