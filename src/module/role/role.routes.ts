import { createElement } from 'react';

import { Navigate, useParams, type RouteObject } from 'react-router';

import { Permission, RequirePermission } from '@core/auth/authorization';

import { RoleListPage } from './pages/RoleListPage';
import { roleDetailPath, roleNewPath } from './utils';

// A role is shown and edited in the list's side panel; these keep older links and the breadcrumb working.
const RoleDetailRedirect = () => {
	const { name = '' } = useParams();
	return createElement(Navigate, { to: roleDetailPath(name), replace: true });
};

const RoleNewRedirect = () => createElement(Navigate, { to: roleNewPath(), replace: true });

export const roleRoutes: RouteObject = {
	path: 'role',
	element: createElement(RequirePermission, { rule: Permission.RolesRead }),
	children: [
		{ index: true, Component: RoleListPage },
		{ path: 'new', Component: RoleNewRedirect },
		{ path: ':name/edit', Component: RoleDetailRedirect },
		{ path: ':name', Component: RoleDetailRedirect },
	],
};
