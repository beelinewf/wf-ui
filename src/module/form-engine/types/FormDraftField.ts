import type { JsonSchema } from '@common/types/JsonSchema';

import type { FormCondition } from './FormCondition';
import type { FormFieldUi } from './FormFieldUi';
import type { FormGroupStyle } from './FormGroupStyle';
import type { FormRemoteOptions } from './FormRemoteOptions';
import type { FormWidget } from './FormWidget';

export type FormDraftValueType = 'string' | 'number' | 'integer' | 'boolean';

/** Schema constraints the property panel edits; which apply depends on the widget. */
export interface FormDraftConstraints {
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	/** Only `email` or `uri` here; date and time formats follow from the widget. */
	format?: 'email' | 'uri';
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	multipleOf?: number;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	/** File fields: `allowed_mime_types`. */
	allowedMimeTypes?: string[];
	/** File fields: `max_file_bytes`, per file. */
	maxFileBytes?: number;
}

/** A field the builder fully models. */
export interface FormDraftInputField {
	kind: 'input';
	/** Stable across renames, for selection and drag and drop. */
	id: string;
	key: string;
	widget: FormWidget;
	/** The value's type, or each item's for list widgets. Ignored by group and repeater. */
	valueType: FormDraftValueType;
	required: boolean;
	/** Written as the schema `title`. */
	label: string;
	/** Written as the schema `description`. */
	help: string;
	placeholder: string;
	colSpan?: number;
	visibleWhen?: FormCondition;
	/** Only for `group` and `repeater`; unset is `default`. */
	groupStyle?: FormGroupStyle;
	/** Only for `file`: a list of files rather than one. */
	multiple?: boolean;
	/** Remote-select request; `multiple` there makes the value a list. */
	options?: FormRemoteOptions;
	default?: unknown;
	/** Options of select, radio, multi-select and checkbox group. */
	enumValues: unknown[];
	constraints: FormDraftConstraints;
	/** A group's properties, or a repeater's item properties. */
	children: FormDraftField[];
	/** Sets `additionalProperties: false` on a group or repeater item. */
	strict: boolean;
	/** Keywords the builder doesn't edit but writes back unchanged, e.g. `examples`. */
	extra: Record<string, unknown>;
	/** The same for an array's `items` schema. */
	itemExtra: Record<string, unknown>;
}

/** A subtree the builder can't model, kept byte for byte and edited in the JSON tab. */
export interface FormDraftRawField {
	kind: 'raw';
	id: string;
	key: string;
	required: boolean;
	schema: JsonSchema;
	/** Its `ui.fields` entries, by path relative to the field: `''` is the field itself, `.x` a child. */
	ui: Record<string, FormFieldUi>;
	/** Why it couldn't be modelled. */
	reason: string;
}

export type FormDraftField = FormDraftInputField | FormDraftRawField;
