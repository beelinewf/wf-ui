import type { IconType } from 'react-icons';
import {
	LuBraces,
	LuCalendar,
	LuCalendarClock,
	LuCircleDot,
	LuClock,
	LuCloudDownload,
	LuHash,
	LuListChecks,
	LuListPlus,
	LuPaperclip,
	LuSquareCheck,
	LuSquareChevronDown,
	LuTags,
	LuText,
	LuTextCursorInput,
	LuToggleRight,
} from 'react-icons/lu';

import { humanizeKey } from '@module/form-engine/components/SchemaForm';
import type { FormBuilderFieldTab, FormBuilderFormTab } from '@module/form-engine/types/FormBuilderInspectorTab';
import type { FormDraftField } from '@module/form-engine/types/FormDraftField';
import type { FormWidget } from '@module/form-engine/types/FormWidget';

export interface FormWidgetMeta {
	icon: IconType;
	/** A Mantine color, shared by every widget of a palette group. */
	color: string;
	description: string;
}

export const FORM_WIDGET_GROUPS: { id: string; title: string; color: string; widgets: FormWidget[] }[] = [
	{ id: 'basic', title: 'Basic', color: 'blue', widgets: ['text', 'textarea', 'number', 'switch', 'checkbox'] },
	{
		id: 'choice',
		title: 'Choice',
		color: 'violet',
		widgets: ['select', 'radio', 'multiselect', 'checkbox-group', 'remote-select'],
	},
	{ id: 'date', title: 'Date and time', color: 'teal', widgets: ['date', 'datetime', 'time'] },
	{ id: 'structure', title: 'Structure', color: 'orange', widgets: ['group', 'repeater'] },
	{ id: 'files', title: 'Files', color: 'grape', widgets: ['file'] },
];

const WIDGET_DETAILS: Record<FormWidget, { icon: IconType; description: string }> = {
	text: { icon: LuTextCursorInput, description: 'Single line of text' },
	textarea: { icon: LuText, description: 'Multi-line text' },
	number: { icon: LuHash, description: 'Integer or decimal' },
	switch: { icon: LuToggleRight, description: 'On or off toggle' },
	checkbox: { icon: LuSquareCheck, description: 'One yes or no box' },
	select: { icon: LuSquareChevronDown, description: 'Pick one from a list' },
	radio: { icon: LuCircleDot, description: 'Pick one, all shown' },
	multiselect: { icon: LuTags, description: 'Pick several from a list' },
	'checkbox-group': { icon: LuListChecks, description: 'Tick several boxes' },
	'remote-select': { icon: LuCloudDownload, description: 'Options from an endpoint' },
	date: { icon: LuCalendar, description: 'Calendar date' },
	datetime: { icon: LuCalendarClock, description: 'Date with a time' },
	time: { icon: LuClock, description: 'Time of day' },
	group: { icon: LuBraces, description: 'Nested object of fields' },
	repeater: { icon: LuListPlus, description: 'List of repeated items' },
	file: { icon: LuPaperclip, description: 'Upload one or more files' },
};

export const FORM_WIDGET_META = Object.fromEntries(
	FORM_WIDGET_GROUPS.flatMap((group) =>
		group.widgets.map((widget) => [widget, { ...WIDGET_DETAILS[widget], color: group.color }]),
	),
) as Record<FormWidget, FormWidgetMeta>;

/** A field the builder can't edit, kept as written. */
export const FORM_RAW_FIELD_META: FormWidgetMeta = { icon: LuBraces, color: 'gray', description: 'Edited as JSON' };

export const draftFieldTitle = (field: FormDraftField) =>
	field.kind === 'input' && field.label ? field.label : humanizeKey(field.key) || field.key;

export const FORM_BUILDER_FIELD_TAB_LABELS: Record<FormBuilderFieldTab, string> = {
	general: 'General',
	data: 'Data',
	validation: 'Validation',
	style: 'Style',
	logic: 'Logic',
};

export const FORM_BUILDER_FORM_TABS: { value: FormBuilderFormTab; label: string }[] = [
	{ value: 'general', label: 'General' },
	{ value: 'layout', label: 'Layout' },
	{ value: 'sections', label: 'Sections' },
	{ value: 'summary', label: 'Summary' },
];
