import type { Permission } from '@core/auth/authorization';

export type PermissionGroupId =
	| 'definitions'
	| 'instances'
	| 'schedules'
	| 'secrets'
	| 'forms'
	| 'statistics'
	| 'roles'
	| 'users';

export interface PermissionGroup {
	id: PermissionGroupId;
	label: string;
	permissions: Permission[];
}
