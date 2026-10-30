import type { JsonSchema } from '@common/types/JsonSchema';

import type { FormCondition } from './FormCondition';
import type { FormGroupStyle } from './FormGroupStyle';
import type { FormRemoteOptions } from './FormRemoteOptions';
import type { FormWidget } from './FormWidget';

/** A file field's rules, read from its schema. */
export interface FormFieldFile {
	/** A list of files rather than one. */
	multiple: boolean;
	/** `allowed_mime_types`: `type/subtype` or `type/*`; empty allows any type. */
	accept: string[];
	/** `max_file_bytes`, per file. */
	maxBytes?: number;
}

/** One field of a form, resolved from its schema and `ui`, ready to render, validate and build a payload from. */
export interface FormFieldModel {
	key: string;
	/** Dotted path into `ui.fields`, with `*` for array items, e.g. `items.*.sku`. */
	uiPath: string;
	/** The property schema with local `$ref`s resolved. */
	schema: JsonSchema;
	required: boolean;
	/** `json` when the subtree uses keywords the engine can't express; it is then edited as raw JSON. */
	widget: FormWidget | 'json';
	label: string;
	help?: string;
	placeholder?: string;
	colSpan?: number;
	visibleWhen?: FormCondition;
	options?: FormRemoteOptions;
	/** Only for `group` and `repeater`. */
	groupStyle?: FormGroupStyle;
	/** Only for `file`. */
	file?: FormFieldFile;
	/** A group's properties, or a repeater's item properties. */
	children: FormFieldModel[];
	/** A group or repeater item that sets `additionalProperties: false`. */
	strict: boolean;
}
