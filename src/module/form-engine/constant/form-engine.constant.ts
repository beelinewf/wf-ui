import type { FormConditionOp } from '@module/form-engine/types/FormConditionOp';
import type { FormGroupStyle } from '@module/form-engine/types/FormGroupStyle';
import type { FormSectionStyle } from '@module/form-engine/types/FormSectionStyle';
import type { FormWidget } from '@module/form-engine/types/FormWidget';

/** The `ui` contract version this build reads and writes. */
export const FORM_UI_VERSION = 1;

export const FORM_MAX_COLUMNS = 4;

export const FORM_WIDGET_LABELS: Record<FormWidget, string> = {
	text: 'Text',
	textarea: 'Long text',
	number: 'Number',
	switch: 'Switch',
	checkbox: 'Checkbox',
	select: 'Select',
	radio: 'Radio group',
	multiselect: 'Multi-select',
	'checkbox-group': 'Checkbox group',
	date: 'Date',
	datetime: 'Date and time',
	time: 'Time',
	group: 'Group',
	repeater: 'Repeater',
	'remote-select': 'Remote select',
	file: 'File upload',
};

export const FORM_GROUP_STYLE_LABELS: Record<FormGroupStyle, string> = {
	default: 'Default',
	filled: 'Filled',
	dotted: 'Dotted',
	unstyled: 'Unstyled',
	card: 'Card',
};

export const FORM_SECTION_STYLE_LABELS: Record<FormSectionStyle, string> = {
	long: 'Full long form',
	stepper: 'Stepper',
	accordion: 'Accordion',
};

export const FORM_CONDITION_OP_LABELS: Record<FormConditionOp, string> = {
	eq: 'equals',
	neq: 'does not equal',
	in: 'is one of',
	notIn: 'is not one of',
	empty: 'is empty',
	notEmpty: 'is not empty',
	gt: 'is greater than',
	lt: 'is less than',
};

/** String formats the compiler checks; any other `format` is carried through as a plain string. */
export const FORM_STRING_FORMATS = ['email', 'uri', 'date', 'date-time', 'time'] as const;

/** Keywords that hold a subtree the compiler can't express; it falls back to a JSON field there. */
export const FORM_UNSUPPORTED_KEYWORDS = [
	'oneOf',
	'anyOf',
	'allOf',
	'not',
	'if',
	'then',
	'else',
	'patternProperties',
	'dependentSchemas',
	'dependentRequired',
	'prefixItems',
	'contains',
	'unevaluatedProperties',
	'unevaluatedItems',
	'propertyNames',
] as const;

export const FORM_REMOTE_DEFAULT_DEBOUNCE_MS = 300;

export const FORM_REMOTE_DEFAULT_MIN_CHARS = 1;

/** Placeholder for the item segment of an array path in `ui.fields`, e.g. `items.*.sku`. */
export const FORM_ITEM_SEGMENT = '*';
