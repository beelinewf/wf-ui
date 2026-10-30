import { Permission } from '@core/auth/authorization';

import type { PermissionGroup, PermissionGroupId } from '@module/role/types/PermissionGroup';

export const PERMISSION_META: Record<Permission, { group: PermissionGroupId; label: string }> = {
	[Permission.DefinitionsRead]: {
		group: 'definitions',
		label: 'View definitions and node library',
	},
	[Permission.DefinitionsWrite]: {
		group: 'definitions',
		label: 'Create and delete definitions',
	},
	[Permission.InstancesCreate]: { group: 'instances', label: 'Start runs' },
	[Permission.InstancesRead]: {
		group: 'instances',
		label: 'View runs, context and node debug',
	},
	[Permission.InstancesUpdateContext]: {
		group: 'instances',
		label: 'Edit a run context',
	},
	[Permission.InputDeliver]: {
		group: 'instances',
		label: 'Deliver input to a waiting run',
	},
	[Permission.InstancesControl]: {
		group: 'instances',
		label: 'Pause, resume, stop and roll back runs',
	},
	[Permission.InstancesMigrate]: {
		group: 'instances',
		label: 'Migrate runs to a newer version',
	},
	[Permission.SchedulesRead]: { group: 'schedules', label: 'View schedules' },
	[Permission.SchedulesWrite]: {
		group: 'schedules',
		label: 'Create, pause and delete schedules',
	},
	[Permission.SecretsRead]: { group: 'secrets', label: 'View secret keys' },
	[Permission.SecretsWrite]: {
		group: 'secrets',
		label: 'Create, rotate and delete secrets',
	},
	[Permission.FormsRead]: {
		group: 'forms',
		label: 'View forms and where they are used',
	},
	[Permission.FormsWrite]: {
		group: 'forms',
		label: 'Create, edit and delete forms',
	},
	[Permission.StatisticsRead]: {
		group: 'statistics',
		label: 'View dashboard statistics',
	},
	[Permission.RolesRead]: {
		group: 'roles',
		label: 'View roles and their permissions',
	},
	[Permission.RolesWrite]: {
		group: 'roles',
		label: 'Create, edit and delete roles',
	},
	[Permission.UsersRead]: { group: 'users', label: 'View the user directory' },
	[Permission.UsersWrite]: {
		group: 'users',
		label: 'Create, edit and disable local users',
	},
};

const GROUP_LABELS: Record<PermissionGroupId, string> = {
	definitions: 'Workflow definitions',
	instances: 'Workflow runs',
	schedules: 'Schedules',
	secrets: 'Secrets',
	forms: 'Forms',
	statistics: 'Statistics',
	roles: 'Roles',
	users: 'Users',
};

/** The Permission catalog grouped by resource, in display order. */
export const PERMISSION_GROUPS: PermissionGroup[] = (Object.keys(GROUP_LABELS) as PermissionGroupId[]).map((id) => ({
	id,
	label: GROUP_LABELS[id],
	permissions: (Object.keys(PERMISSION_META) as Permission[]).filter(
		(permission) => PERMISSION_META[permission].group === id,
	),
}));

/** The list's query param naming the role whose drawer is open. */
export const ROLE_DETAIL_PARAM = 'role';

/** The list's query param that opens the new-role form in the side panel. */
export const ROLE_NEW_PARAM = 'new';
