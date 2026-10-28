import { createElement } from 'react';

import type { RouteObject } from 'react-router';

import { Permission, RequirePermission } from '@core/auth/authorization';

import { UserListPage } from './pages/UserListPage';

export const userRoutes: RouteObject = {
	path: 'user',
	element: createElement(RequirePermission, { rule: Permission.UsersRead }),
	children: [{ index: true, Component: UserListPage }],
};
