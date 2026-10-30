import type { IconType } from 'react-icons';

import type { PermissionRule } from '@core/auth/authorization';

export interface SettingsMenuItem {
	id: string;
	label: string;
	description: string;
	icon: IconType;
	to: string;
	/** Hidden unless the caller satisfies it; the route is guarded separately. */
	permission?: PermissionRule;
	/** Shown only to a local (email and password) account; the page redirects anyone else. */
	localOnly?: boolean;
}
