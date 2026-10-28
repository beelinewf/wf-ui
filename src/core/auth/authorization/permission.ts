// Mirrors KnownActions() in simpwf/internal/workflow/auth/principal.go, in the same order and spelling.
export const Permission = {
	DefinitionsRead: 'definitions:read',
	DefinitionsWrite: 'definitions:write',
	SecretsRead: 'secrets:read',
	SecretsWrite: 'secrets:write',
	FormsRead: 'forms:read',
	FormsWrite: 'forms:write',
	InstancesCreate: 'instances:create',
	InstancesRead: 'instances:read',
	InstancesUpdateContext: 'instances:update-context',
	InputDeliver: 'input:deliver',
	InstancesControl: 'instances:control',
	InstancesMigrate: 'instances:migrate',
	StatisticsRead: 'statistics:read',
	RolesRead: 'roles:read',
	UsersRead: 'users:read',
	SchedulesRead: 'schedules:read',
	SchedulesWrite: 'schedules:write',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

// The bypass, not something a call site asks for, so it stays out of the Permission union.
export const WILDCARD_PERMISSION = '*';
