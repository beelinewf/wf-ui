import React from 'react';

import { Skeleton } from '@mantine/core';
import { Navigate } from 'react-router';

import { useMe } from '@core/auth/hooks';
import { selectAuthMethod } from '@core/auth/store';
import { useCoreSelector } from '@core/store';

import { MyPasswordCard } from '@module/settings/components/MyPasswordCard';

/** Changing the password of a local account; SSO users have none here. */
export const MyPasswordPage: React.FC = () => {
	const isLocal = useCoreSelector(selectAuthMethod) === 'local';
	const { data: me } = useMe();

	if (!isLocal) return <Navigate to="/app/settings/access" replace />;
	if (!me) return <Skeleton height={300} radius="md" />;

	return <MyPasswordCard me={me} />;
};
