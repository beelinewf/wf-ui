import type { JsonSchema } from '@common/types/JsonSchema';

import { humanizeKey, isRecord, resolveSchema, schemaTypes } from '@module/form-engine/components/SchemaForm';
import { FORM_ITEM_SEGMENT, FORM_UNSUPPORTED_KEYWORDS, FORM_WIDGET_LABELS } from '@module/form-engine/constant';
import { parseFormUi } from '@module/form-engine/dto';
import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';
import type { FormFieldUi } from '@module/form-engine/types/FormFieldUi';
import type { FormModel } from '@module/form-engine/types/FormModel';
import type { FormUi } from '@module/form-engine/types/FormUi';
import type { FormWidget } from '@module/form-engine/types/FormWidget';

const FULL_WIDTH: ReadonlySet<FormFieldModel['widget']> = new Set(['group', 'repeater', 'textarea', 'json']);

/** `format: binary` marks a file: on the property for one file, on its `items` for a list. */
export const FORM_FILE_FORMAT = 'binary';

const valueTypes = (schema: JsonSchema) => schemaTypes(schema).filter((type) => type !== 'null');

/** The keywords in `schema` itself (not its children) the compiler can't express. */
export const unsupportedKeywords = (schema: JsonSchema): string[] => {
	const found: string[] = FORM_UNSUPPORTED_KEYWORDS.filter((keyword) => schema[keyword] !== undefined);
	if (schema.const !== undefined) found.push('const');
	if (isRecord(schema.additionalProperties)) found.push('additionalProperties (schema)');
	if (schema.$ref) found.push('$ref (non-local)');
	if (valueTypes(schema).length > 1) found.push('type (multiple)');
	return found;
};

const isScalarEnum = (schema: JsonSchema) =>
	!!schema.enum?.length && schema.enum.every((value) => ['string', 'number', 'boolean'].includes(typeof value));

/** The widget a property gets from its schema alone. */
export const defaultWidget = (schema: JsonSchema, root: JsonSchema): FormFieldModel['widget'] => {
	if (unsupportedKeywords(schema).length) return 'json';
	const [type] = valueTypes(schema);

	if (schema.enum) return isScalarEnum(schema) ? 'select' : 'json';
	switch (type) {
		case 'string':
			if (schema.format === FORM_FILE_FORMAT) return 'file';
			if (schema.format === 'date') return 'date';
			if (schema.format === 'date-time') return 'datetime';
			if (schema.format === 'time') return 'time';
			return 'text';
		case 'number':
		case 'integer':
			return 'number';
		case 'boolean':
			return 'switch';
		case 'object':
			return Object.keys(schema.properties ?? {}).length ? 'group' : 'json';
		case 'array': {
			const items = resolveSchema(schema.items, root);
			if (valueTypes(items)[0] === 'string' && items.format === FORM_FILE_FORMAT) return 'file';
			if (isScalarEnum(items)) return 'multiselect';
			if (valueTypes(items)[0] === 'object' && Object.keys(items.properties ?? {}).length) return 'repeater';
			return 'json';
		}
		default:
			return schema.properties ? 'group' : 'json';
	}
};

/** The widgets that can edit a property, the default first. Empty for a JSON fallback. */
export const compatibleWidgets = (schema: JsonSchema, root: JsonSchema): FormWidget[] => {
	const fallback = defaultWidget(schema, root);
	if (fallback === 'json') return [];
	const [type] = valueTypes(schema);

	const options: FormWidget[] = (() => {
		if (fallback === 'file') return ['file'];
		if (fallback === 'select') return ['select', 'radio'];
		if (fallback === 'multiselect') return ['multiselect', 'checkbox-group', 'remote-select'];
		switch (type) {
			case 'string':
				return ['text', 'textarea', 'date', 'datetime', 'time', 'remote-select'];
			case 'number':
			case 'integer':
				return ['number', 'remote-select'];
			case 'boolean':
				return ['switch', 'checkbox'];
			default:
				return [fallback];
		}
	})();
	return [fallback, ...options.filter((widget) => widget !== fallback)];
};

/** Arrays of plain strings or numbers have no widget of their own, but a multi remote-select fits them. */
const remoteListFits = (schema: JsonSchema, root: JsonSchema) => {
	if (valueTypes(schema)[0] !== 'array') return false;
	const [itemType] = valueTypes(resolveSchema(schema.items, root));
	return itemType === 'string' || itemType === 'number' || itemType === 'integer';
};

/**
 * `properties` keys in `order` first, then the rest in schema order. The stored schema's key order can't be relied on
 * (the backend may sort it), so `ui` carries the order.
 */
export const orderedKeys = (properties: Record<string, JsonSchema>, order: string[] = []) => [
	...order.filter((key, index) => key in properties && order.indexOf(key) === index),
	...Object.keys(properties).filter((key) => !order.includes(key)),
];

const stringList = (value: unknown) =>
	Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** A file field's rules. The annotations sit on the property itself; on `items` is read too, as a fallback. */
export const fileRules = (schema: JsonSchema, root: JsonSchema): FormFieldModel['file'] => {
	const multiple = valueTypes(schema)[0] === 'array';
	const items = multiple ? resolveSchema(schema.items, root) : {};
	const maxBytes = schema.max_file_bytes ?? items.max_file_bytes;
	return {
		multiple,
		accept: stringList(schema.allowed_mime_types ?? items.allowed_mime_types),
		maxBytes: typeof maxBytes === 'number' && maxBytes > 0 ? maxBytes : undefined,
	};
};

interface BuildContext {
	root: JsonSchema;
	ui: FormUi | null;
	warnings: string[];
}

const buildField = (
	key: string,
	raw: JsonSchema,
	required: boolean,
	uiPath: string,
	ctx: BuildContext,
): FormFieldModel => {
	const schema = resolveSchema(raw, ctx.root);
	const fieldUi: FormFieldUi = ctx.ui?.fields?.[uiPath] ?? {};
	const fallback = defaultWidget(schema, ctx.root);

	let widget: FormFieldModel['widget'] = fallback;
	if (fallback === 'file' && uiPath.includes('.')) {
		// Multipart parts are flat and the engine checks file rules on top-level properties only.
		ctx.warnings.push(`${uiPath}: file fields must be top level, so it's edited as JSON`);
		widget = 'json';
	} else if (fallback === 'json') {
		const keywords = unsupportedKeywords(schema);
		ctx.warnings.push(
			keywords.length
				? `${uiPath}: ${keywords.join(', ')} isn't supported, so it's edited as JSON`
				: `${uiPath}: no form field fits this schema, so it's edited as JSON`,
		);
		if (fieldUi.widget === 'remote-select' && remoteListFits(schema, ctx.root)) widget = 'remote-select';
	} else if (fieldUi.widget) {
		if (compatibleWidgets(schema, ctx.root).includes(fieldUi.widget)) widget = fieldUi.widget;
		else ctx.warnings.push(`${uiPath}: widget "${fieldUi.widget}" doesn't fit this field's type; it's ignored`);
	}
	if (widget === 'remote-select' && !fieldUi.options) {
		ctx.warnings.push(`${uiPath}: remote select has no request configured`);
	}

	const childOf = (properties: Record<string, JsonSchema>, requiredKeys: string[], prefix: string) =>
		orderedKeys(properties, fieldUi.order).map((childKey) =>
			buildField(childKey, properties[childKey], requiredKeys.includes(childKey), `${prefix}.${childKey}`, ctx),
		);

	let children: FormFieldModel[] = [];
	let strict = false;
	if (widget === 'group') {
		children = childOf(schema.properties ?? {}, schema.required ?? [], uiPath);
		strict = schema.additionalProperties === false;
	} else if (widget === 'repeater') {
		const items = resolveSchema(schema.items, ctx.root);
		children = childOf(items.properties ?? {}, items.required ?? [], `${uiPath}.${FORM_ITEM_SEGMENT}`);
		strict = items.additionalProperties === false;
	}

	return {
		key,
		uiPath,
		schema,
		required,
		widget,
		label: fieldUi.label || schema.title || humanizeKey(key),
		help: fieldUi.help || schema.description,
		placeholder: fieldUi.placeholder,
		colSpan: fieldUi.colSpan ?? (FULL_WIDTH.has(widget) ? undefined : 1),
		visibleWhen: fieldUi.visibleWhen,
		options: fieldUi.options,
		groupStyle: widget === 'group' || widget === 'repeater' ? fieldUi.groupStyle : undefined,
		file: widget === 'file' ? fileRules(schema, ctx.root) : undefined,
		children,
		strict,
	};
};

/** Resolves a form's `{schema, ui}` into a field tree. Never throws: a broken `ui` is dropped with a warning. */
export const buildFormModel = (schema: JsonSchema, rawUi?: unknown): FormModel => {
	const { ui, warnings } = parseFormUi(rawUi);
	const ctx: BuildContext = { root: schema, ui, warnings: [...warnings] };
	const root = resolveSchema(schema, schema);
	const properties = root.properties ?? {};
	const ordered = orderedKeys(properties, ui?.order);
	const fields = ordered.map((key) =>
		buildField(key, properties[key], (root.required ?? []).includes(key), key, ctx),
	);

	const claimed = new Set<string>();
	const sections = (ui?.sections ?? []).map((section) => ({
		...section,
		fields: section.fields.filter((key) => {
			if (!(key in properties) || claimed.has(key)) return false;
			claimed.add(key);
			return true;
		}),
	}));

	return {
		root: schema,
		fields,
		ungrouped: ordered.filter((key) => !claimed.has(key)),
		sections,
		sectionStyle: ui?.layout?.sectionStyle ?? 'long',
		columns: ui?.layout?.columns ?? 1,
		strict: root.additionalProperties === false,
		warnings: ctx.warnings,
	};
};

/** Whether the form has a file field, so its payload has to go out as `multipart/form-data`. */
export const hasFileFields = (model: FormModel) => model.fields.some((field) => field.widget === 'file');

export const formWidgetLabel = (widget: FormFieldModel['widget']) =>
	widget === 'json' ? 'JSON' : FORM_WIDGET_LABELS[widget];

/** Whether the error or value at `path` belongs to one of the top-level `keys`. */
export const isPathUnder = (path: string, keys: string[]) =>
	keys.some((key) => path === key || path.startsWith(`${key}.`));

/** The sections a stepper steps through: those with at least one field. Empty for any other section style. */
export const formSteps = (model: FormModel) =>
	model.sectionStyle === 'stepper' ? model.sections.filter((section) => section.fields.length > 0) : [];

export const joinValuePath = (prefix: string, key: string | number) => (prefix ? `${prefix}.${key}` : String(key));

/** Every field of a model, depth first, groups and repeater items included. */
export const walkFormModel = (fields: FormFieldModel[]): FormFieldModel[] =>
	fields.flatMap((field) => [field, ...walkFormModel(field.children)]);
