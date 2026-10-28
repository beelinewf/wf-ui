import {
	LuBoxes,
	LuCalendarClock,
	LuClipboardList,
	LuHouse,
	LuKeyRound,
	LuPlay,
	LuSettings,
	LuUsers,
	LuWorkflow,
} from 'react-icons/lu';

import { Permission } from '@core/auth/authorization/permission';

import type { MenuConfig } from '@common/types/MenuItem';

export const menuConfig: MenuConfig = {
	top: [
		{
			id: 'dashboard',
			label: 'Dashboard',
			icon: LuHouse,
			to: '/app/dashboard',
			permission: Permission.StatisticsRead,
		},
		{
			id: 'workflow-definition',
			label: 'Workflow Definition',
			icon: LuWorkflow,
			to: '/app/workflow-definition',
			permission: Permission.DefinitionsRead,
		},
		{
			id: 'node-definition',
			label: 'Node Library',
			icon: LuBoxes,
			to: '/app/node-definition',
			permission: Permission.DefinitionsRead,
		},
		{
			id: 'workflow-run',
			label: 'Workflow Run',
			icon: LuPlay,
			to: '/app/workflow-run',
			permission: Permission.InstancesRead,
		},
		{
			id: 'schedule',
			label: 'Schedules',
			icon: LuCalendarClock,
			to: '/app/schedule',
			permission: Permission.SchedulesRead,
		},
		{ id: 'form', label: 'Forms', icon: LuClipboardList, to: '/app/form', permission: Permission.FormsRead },
		{ id: 'secret', label: 'Secrets', icon: LuKeyRound, to: '/app/secret', permission: Permission.SecretsRead },
		{ id: 'user', label: 'Users', icon: LuUsers, to: '/app/user', permission: Permission.UsersRead },
	],
	bottom: [{ id: 'settings', label: 'Settings', icon: LuSettings, to: '/app/settings' }],
};
