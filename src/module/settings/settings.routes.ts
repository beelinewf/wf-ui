import { Navigate, type RouteObject } from 'react-router';

import { MyAccessPage } from './pages/MyAccessPage';
import { PreferencePage } from './pages/PreferencePage';
import { SettingsLayoutPage } from './pages/SettingsLayoutPage';

export const settingsRoutes: RouteObject = {
	path: 'settings',
	Component: SettingsLayoutPage,
	children: [
		{ index: true, Component: () => Navigate({ to: 'preference', replace: true }) },
		{ path: 'preference', Component: PreferencePage },
		// Everyone may see what they hold, so this page has no permission gate.
		{ path: 'access', Component: MyAccessPage },
	],
};
