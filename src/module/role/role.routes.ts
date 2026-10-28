import { createElement } from 'react';

import type { RouteObject } from 'react-router';

import { Permission, RequirePermission } from '@core/auth/authorization';

import { RoleListPage } from './pages/RoleListPage';

export const roleRoutes: RouteObject = {
	path: 'role',
	element: createElement(RequirePermission, { rule: Permission.RolesRead }),
	children: [{ index: true, Component: RoleListPage }],
};
