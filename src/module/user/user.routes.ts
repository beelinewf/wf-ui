import { createElement } from 'react';

import { Navigate, useParams, type RouteObject } from 'react-router';

import { Permission, RequirePermission } from '@core/auth/authorization';

import { UserListPage } from './pages/UserListPage';
import { userDetailPath, userNewPath } from './utils';

// A user is shown and edited in the list's side panel; these keep older links and the breadcrumb working.
const UserDetailRedirect = () => {
	const { id = '' } = useParams();
	return createElement(Navigate, { to: userDetailPath(id), replace: true });
};

const UserNewRedirect = () => createElement(Navigate, { to: userNewPath(), replace: true });

export const userRoutes: RouteObject = {
	path: 'user',
	element: createElement(RequirePermission, { rule: Permission.UsersRead }),
	children: [
		{ index: true, Component: UserListPage },
		{ path: 'new', Component: UserNewRedirect },
		{ path: ':id/edit', Component: UserDetailRedirect },
		{ path: ':id', Component: UserDetailRedirect },
	],
};
