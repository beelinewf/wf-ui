import type { JsonSchema } from '@common/types/JsonSchema';

import { resolveSchema, schemaTypes } from '@module/form-engine/components/SchemaForm';
import { FORM_ITEM_SEGMENT, FORM_UI_VERSION } from '@module/form-engine/constant';
import { parseFormUi } from '@module/form-engine/dto';
import type { FormContentType } from '@module/form-engine/types/FormContentType';
import type { FormDraft } from '@module/form-engine/types/FormDraft';
import type {
	FormDraftConstraints,
	FormDraftField,
	FormDraftInputField,
	FormDraftValueType,
} from '@module/form-engine/types/FormDraftField';
import type { FormFieldUi } from '@module/form-engine/types/FormFieldUi';
import type { FormUi } from '@module/form-engine/types/FormUi';
import type { FormWidget } from '@module/form-engine/types/FormWidget';

import {
	FORM_FILE_FORMAT,
	compatibleWidgets,
	defaultWidget,
	fileRules,
	orderedKeys,
	unsupportedKeywords,
} from './form.model';

let idCounter = 0;

/** A draft-local id; only needs to be unique within the page. */
export const draftFieldId = () => `f${(idCounter += 1)}_${Math.random().toString(36).slice(2, 7)}`;

const CONSTRAINT_KEYS = [
	'minLength',
	'maxLength',
	'pattern',
	'minimum',
	'maximum',
	'exclusiveMinimum',
	'exclusiveMaximum',
	'multipleOf',
	'minItems',
	'maxItems',
	'uniqueItems',
] as const;

/** Keywords a modelled field consumes; the rest go to `extra` and are written back unchanged. */
const MODELLED_KEYWORDS = new Set<string>([
	'type',
	'title',
	'description',
	'default',
	'enum',
	'format',
	'items',
	'properties',
	'required',
	'additionalProperties',
	...CONSTRAINT_KEYS,
]);

const ITEM_KEYWORDS = new Set(['type', 'enum', 'properties', 'required', 'additionalProperties']);

/** File annotations; a file field consumes them, any other field keeps them in `extra`. */
const FILE_KEYWORDS = ['allowed_mime_types', 'max_file_bytes'] as const;

const LIST_WIDGETS: ReadonlySet<FormWidget> = new Set(['multiselect', 'checkbox-group']);

const FULL_WIDTH: ReadonlySet<FormWidget> = new Set(['group', 'repeater', 'textarea']);

const pick = (schema: JsonSchema, skip: ReadonlySet<string>) =>
	Object.fromEntries(Object.entries(schema).filter(([key]) => !skip.has(key)));

const valueType = (schema: JsonSchema): FormDraftValueType => {
	const [type] = schemaTypes(schema).filter((item) => item !== 'null');
	if (type === 'number' || type === 'integer' || type === 'boolean') return type;
	if (!type && schema.enum?.every((value) => typeof value === 'number')) return 'number';
	return 'string';
};

/** The `ui.fields` entries at or under `path`, re-keyed relative to it. */
const uiUnder = (ui: FormUi | null, path: string): Record<string, FormFieldUi> =>
	Object.fromEntries(
		Object.entries(ui?.fields ?? {}).flatMap(([key, value]) =>
			key === path ? [['', value]] : key.startsWith(`${path}.`) ? [[key.slice(path.length), value]] : [],
		),
	);

interface ParseContext {
	root: JsonSchema;
	ui: FormUi | null;
	warnings: string[];
}

const rawField = (
	key: string,
	schema: JsonSchema,
	required: boolean,
	path: string,
	reason: string,
	ctx: ParseContext,
): FormDraftField => {
	ctx.warnings.push(`${path}: ${reason}; kept as JSON`);
	return { kind: 'raw', id: draftFieldId(), key, required, schema, ui: uiUnder(ctx.ui, path), reason };
};

const parseChildren = (
	properties: Record<string, JsonSchema>,
	required: string[],
	order: string[] | undefined,
	prefix: string,
	ctx: ParseContext,
): FormDraftField[] =>
	orderedKeys(properties, order).map((key) =>
		parseField(key, properties[key], required.includes(key), prefix ? `${prefix}.${key}` : key, ctx),
	);

const parseField = (
	key: string,
	schema: JsonSchema,
	required: boolean,
	path: string,
	ctx: ParseContext,
): FormDraftField => {
	// A `$ref` would be inlined on save, so the field is kept as written.
	if (schema.$ref) return rawField(key, schema, required, path, 'it uses $ref', ctx);
	const unsupported = unsupportedKeywords(schema);
	if (unsupported.length)
		return rawField(key, schema, required, path, `${unsupported.join(', ')} isn't supported`, ctx);

	const fieldUi = ctx.ui?.fields?.[path] ?? {};
	const fallback = defaultWidget(schema, ctx.root);
	const items = schema.items ? resolveSchema(schema.items, ctx.root) : undefined;
	const remoteList =
		fieldUi.widget === 'remote-select' && fallback === 'json' && !!items && !items.$ref && !items.enum;

	if (fallback === 'json' && !remoteList) {
		return rawField(key, schema, required, path, 'no form field fits it', ctx);
	}
	if (items?.$ref || (items && unsupportedKeywords(items).length)) {
		return rawField(key, schema, required, path, 'its items use keywords the builder can’t edit', ctx);
	}

	const widget: FormWidget = remoteList
		? 'remote-select'
		: fieldUi.widget && compatibleWidgets(schema, ctx.root).includes(fieldUi.widget)
			? fieldUi.widget
			: (fallback as FormWidget);

	const constraints: FormDraftConstraints = {};
	for (const name of CONSTRAINT_KEYS) {
		if (schema[name] !== undefined) (constraints as Record<string, unknown>)[name] = schema[name];
	}
	const extra = pick(schema, MODELLED_KEYWORDS);
	if (schema.format === 'email' || schema.format === 'uri') constraints.format = schema.format;
	else if (schema.format && !['date', 'date-time', 'time', FORM_FILE_FORMAT].includes(schema.format)) {
		extra.format = schema.format;
	}
	const file = widget === 'file' ? fileRules(schema, ctx.root) : undefined;
	if (file) {
		for (const name of FILE_KEYWORDS) delete extra[name];
		if (file.accept.length) constraints.allowedMimeTypes = file.accept;
		if (file.maxBytes !== undefined) constraints.maxFileBytes = file.maxBytes;
	}

	const isArray = schemaTypes(schema).includes('array');
	const children =
		widget === 'group'
			? parseChildren(schema.properties ?? {}, schema.required ?? [], fieldUi.order, path, ctx)
			: widget === 'repeater' && items
				? parseChildren(
						items.properties ?? {},
						items.required ?? [],
						fieldUi.order,
						`${path}.${FORM_ITEM_SEGMENT}`,
						ctx,
					)
				: [];
	const options =
		widget === 'remote-select' && fieldUi.options
			? { ...fieldUi.options, multiple: isArray || undefined }
			: fieldUi.options;
	const itemExtra = items ? pick(items, ITEM_KEYWORDS) : {};
	if (file) {
		delete itemExtra.format;
		for (const name of FILE_KEYWORDS) delete itemExtra[name];
	}

	return {
		kind: 'input',
		id: draftFieldId(),
		key,
		widget,
		valueType: valueType(isArray && items ? items : schema),
		required,
		label: fieldUi.label || schema.title || '',
		help: fieldUi.help || schema.description || '',
		placeholder: fieldUi.placeholder ?? '',
		colSpan: fieldUi.colSpan,
		visibleWhen: fieldUi.visibleWhen,
		groupStyle: widget === 'group' || widget === 'repeater' ? fieldUi.groupStyle : undefined,
		multiple: file ? file.multiple : undefined,
		options,
		default: schema.default,
		enumValues: (isArray ? items?.enum : schema.enum) ?? [],
		constraints,
		children,
		strict: (widget === 'repeater' ? items?.additionalProperties : schema.additionalProperties) === false,
		extra,
		itemExtra,
	};
};

export interface FormDraftParseResult {
	draft: FormDraft;
	/** Fields kept as JSON and `ui` problems, for the builder to show. */
	warnings: string[];
}

/** A stored form as the builder's draft. Anything it can't model is kept as a raw field, unchanged. */
export const draftFromForm = (
	name: string,
	schema: JsonSchema,
	rawUi?: unknown,
	contentType?: FormContentType | '',
): FormDraftParseResult => {
	const { ui, warnings } = parseFormUi(rawUi);
	const ctx: ParseContext = { root: schema, ui, warnings: [...warnings] };
	const properties = schema.properties ?? {};
	const ordered = orderedKeys(properties, ui?.order);
	const required = schema.required ?? [];

	return {
		draft: {
			name,
			contentType: contentType || 'application/json',
			fields: ordered.map((key) => parseField(key, properties[key], required.includes(key), key, ctx)),
			columns: ui?.layout?.columns ?? 1,
			sectionStyle: ui?.layout?.sectionStyle ?? 'long',
			sections: (ui?.sections ?? []).map((section) => ({
				...section,
				fields: section.fields.filter((key) => key in properties),
			})),
			strict: schema.additionalProperties === false,
			rootExtra: pick(schema, new Set(['type', 'properties', 'required', 'additionalProperties'])),
		},
		warnings: ctx.warnings,
	};
};

const definedConstraints = (constraints: FormDraftConstraints, names: readonly (keyof FormDraftConstraints)[]) =>
	Object.fromEntries(names.flatMap((name) => (constraints[name] === undefined ? [] : [[name, constraints[name]]])));

const STRING_RULES = ['minLength', 'maxLength', 'pattern'] as const;
const NUMBER_RULES = ['minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf'] as const;
const ARRAY_RULES = ['minItems', 'maxItems', 'uniqueItems'] as const;
const FILE_COUNT_RULES = ['minItems', 'maxItems'] as const;

/** A file field's annotations, written on the property itself where the engine reads them. */
const fileAnnotations = (rules: FormDraftConstraints): JsonSchema => ({
	...(rules.allowedMimeTypes?.length ? { allowed_mime_types: rules.allowedMimeTypes } : {}),
	...(rules.maxFileBytes !== undefined ? { max_file_bytes: rules.maxFileBytes } : {}),
});

const objectSchema = (fields: FormDraftField[], strict: boolean, extra: Record<string, unknown> = {}): JsonSchema => {
	const required = fields.filter((field) => field.required).map((field) => field.key);
	return {
		type: 'object',
		...extra,
		properties: Object.fromEntries(fields.map((field) => [field.key, schemaOf(field)])),
		...(required.length ? { required } : {}),
		...(strict ? { additionalProperties: false } : {}),
	};
};

/** The JSON Schema a draft field writes. */
export const schemaOf = (field: FormDraftField): JsonSchema => {
	if (field.kind === 'raw') return field.schema;
	const { constraints: rules } = field;

	const typed: JsonSchema = (() => {
		switch (field.widget) {
			case 'text':
			case 'textarea':
				return {
					type: 'string',
					...(rules.format ? { format: rules.format } : {}),
					...definedConstraints(rules, STRING_RULES),
				};
			case 'date':
				return { type: 'string', format: 'date' };
			case 'datetime':
				return { type: 'string', format: 'date-time' };
			case 'time':
				return { type: 'string', format: 'time' };
			case 'number':
				return {
					type: field.valueType === 'integer' ? 'integer' : 'number',
					...definedConstraints(rules, NUMBER_RULES),
				};
			case 'switch':
			case 'checkbox':
				return { type: 'boolean' };
			case 'select':
			case 'radio':
				return { type: field.valueType, enum: field.enumValues };
			case 'multiselect':
			case 'checkbox-group':
				return {
					type: 'array',
					items: { type: field.valueType, enum: field.enumValues, ...field.itemExtra },
					...definedConstraints(rules, ARRAY_RULES),
				};
			case 'group':
				return objectSchema(field.children, field.strict);
			case 'repeater':
				return {
					type: 'array',
					items: objectSchema(field.children, field.strict, field.itemExtra),
					...definedConstraints(rules, ARRAY_RULES),
				};
			case 'file':
				return field.multiple
					? {
							type: 'array',
							items: { type: 'string', format: FORM_FILE_FORMAT, ...field.itemExtra },
							...fileAnnotations(rules),
							...definedConstraints(rules, FILE_COUNT_RULES),
						}
					: { type: 'string', format: FORM_FILE_FORMAT, ...fileAnnotations(rules) };
			case 'remote-select':
				return field.options?.multiple
					? {
							type: 'array',
							items: { type: field.valueType, ...field.itemExtra },
							...definedConstraints(rules, ARRAY_RULES),
						}
					: { type: field.valueType };
		}
	})();

	const { type, ...rest } = typed;
	return {
		type,
		...(field.label ? { title: field.label } : {}),
		...(field.help ? { description: field.help } : {}),
		...rest,
		...(field.default !== undefined ? { default: field.default } : {}),
		...field.extra,
	};
};

const collectUi = (fields: FormDraftField[], prefix: string, out: Record<string, FormFieldUi>) => {
	for (const field of fields) {
		const path = prefix ? `${prefix}.${field.key}` : field.key;
		if (field.kind === 'raw') {
			for (const [suffix, entry] of Object.entries(field.ui)) out[`${path}${suffix}`] = entry;
			continue;
		}

		const entry: FormFieldUi = {};
		const fallback = defaultWidget(schemaOf(field), {});
		if (field.widget !== fallback) entry.widget = field.widget;
		if (field.placeholder) entry.placeholder = field.placeholder;
		if (field.colSpan !== undefined && field.colSpan !== (FULL_WIDTH.has(field.widget) ? undefined : 1)) {
			entry.colSpan = field.colSpan;
		}
		if (field.visibleWhen) entry.visibleWhen = field.visibleWhen;
		if (
			(field.widget === 'group' || field.widget === 'repeater') &&
			field.groupStyle &&
			field.groupStyle !== 'default'
		) {
			entry.groupStyle = field.groupStyle;
		}
		if ((field.widget === 'group' || field.widget === 'repeater') && field.children.length > 1) {
			entry.order = field.children.map((child) => child.key);
		}
		if (field.widget === 'remote-select' && field.options) {
			const { multiple, ...options } = field.options;
			entry.options = multiple ? { ...options, multiple } : options;
		}
		if (Object.keys(entry).length) out[path] = entry;

		if (field.widget === 'group') collectUi(field.children, path, out);
		if (field.widget === 'repeater') collectUi(field.children, `${path}.${FORM_ITEM_SEGMENT}`, out);
	}
};

/**
 * The `{schema, ui}` a draft saves as. `ui` is left out when it would say nothing. Field order always goes in `ui`:
 * the backend doesn't keep the schema's key order.
 */
export const formFromDraft = (draft: FormDraft): { schema: JsonSchema; ui?: FormUi } => {
	const { type: _type, ...rootExtra } = draft.rootExtra;
	const schema = objectSchema(draft.fields, draft.strict, rootExtra);

	const fields: Record<string, FormFieldUi> = {};
	collectUi(draft.fields, '', fields);
	const sections = draft.sections.filter((section) => section.title.trim() || section.fields.length);

	const layout: FormUi['layout'] = {
		...(draft.columns !== 1 ? { columns: draft.columns } : {}),
		...(sections.length && draft.sectionStyle !== 'long' ? { sectionStyle: draft.sectionStyle } : {}),
	};

	const ui: FormUi = {
		version: FORM_UI_VERSION,
		...(draft.fields.length > 1 ? { order: draft.fields.map((field) => field.key) } : {}),
		...(Object.keys(layout).length ? { layout } : {}),
		...(sections.length ? { sections } : {}),
		...(Object.keys(fields).length ? { fields } : {}),
	};
	return Object.keys(ui).length > 1 ? { schema, ui } : { schema };
};

/** A blank field for `widget`, as the palette adds it. */
export const newDraftField = (widget: FormWidget, key: string): FormDraftInputField => ({
	kind: 'input',
	id: draftFieldId(),
	key,
	widget,
	valueType: widget === 'switch' || widget === 'checkbox' ? 'boolean' : widget === 'number' ? 'number' : 'string',
	required: false,
	label: '',
	help: '',
	placeholder: '',
	colSpan: undefined,
	default: undefined,
	enumValues: ['select', 'radio', 'multiselect', 'checkbox-group'].includes(widget) ? ['Option 1', 'Option 2'] : [],
	constraints: {},
	children: [],
	strict: false,
	extra: {},
	itemExtra: {},
	options: widget === 'remote-select' ? { url: '', method: 'GET', valuePath: 'id', labelPath: 'name' } : undefined,
	multiple: widget === 'file' ? false : undefined,
});

export const isListWidget = (widget: FormWidget) => LIST_WIDGETS.has(widget);

export const emptyDraft = (name = ''): FormDraft => ({
	name,
	contentType: 'application/json',
	fields: [],
	columns: 1,
	sections: [],
	sectionStyle: 'long',
	strict: false,
	rootExtra: {},
});
