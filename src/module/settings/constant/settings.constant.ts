import { LuSlidersHorizontal, LuUserRound } from 'react-icons/lu';

import type { ListViewKey, ListViewPreference } from '@module/settings/types/ListViewPreference';
import type { SettingsMenuItem } from '@module/settings/types/SettingsMenuItem';

export const DEFAULT_LIST_VIEW: ListViewPreference = { workflowDefinition: 'card', workflowRun: 'card' };

export const LIST_VIEW_OPTIONS: { key: ListViewKey; label: string; description: string }[] = [
	{
		key: 'workflowDefinition',
		label: 'Workflow definitions',
		description: 'Layout of the workflow definition list.',
	},
	{
		key: 'workflowRun',
		label: 'Workflow runs',
		description: 'Layout of the workflow run list.',
	},
];

export const SETTINGS_MENU: SettingsMenuItem[] = [
	{
		id: 'preference',
		label: 'Preference',
		description: 'Display defaults',
		icon: LuSlidersHorizontal,
		to: '/app/settings/preference',
	},
	{
		id: 'access',
		label: 'My access',
		description: 'Your roles and permissions',
		icon: LuUserRound,
		to: '/app/settings/access',
	},
];
