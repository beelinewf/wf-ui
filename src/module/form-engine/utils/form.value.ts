import dayjs from 'dayjs';

import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';
import type { FormModel } from '@module/form-engine/types/FormModel';

import { isEmptyValue, isFieldVisible } from './form.condition';
import { joinValuePath } from './form.model';

/** How a datetime picker holds its value; the payload carries ISO 8601 with the local offset instead. */
const PICKER_DATETIME = 'YYYY-MM-DD HH:mm:ss';

/** How a time picker holds a complete value; the payload carries RFC 3339 `full-time` with the local offset instead. */
export const FORM_PICKER_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A stored `full-time` (or a bare `HH:mm`) as the picker's `HH:mm`, in the filler's offset. */
const pickerTime = (value: unknown) => {
	if (typeof value !== 'string') return '';
	const parsed = dayjs(`${dayjs().format('YYYY-MM-DD')}T${value}`);
	return parsed.isValid() && /^\d{2}:\d{2}/.test(value) ? parsed.format('HH:mm') : '';
};

/** `HH:mm` as `HH:mm:00+07:00`, with today's local offset. A partial entry is kept so validation flags it. */
const payloadTime = (value: unknown) => {
	if (typeof value !== 'string' || !value) return undefined;
	if (!FORM_PICKER_TIME.test(value)) return value;
	return dayjs(`${dayjs().format('YYYY-MM-DD')}T${value}`).format('HH:mm:ssZ');
};

type Values = Record<string, unknown>;

const isValues = (value: unknown): value is Values =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** The state a field starts in: its schema `default` if any, else the widget's empty value. */
export const initialFieldValue = (field: FormFieldModel): unknown => {
	const fallback = field.schema.default;

	switch (field.widget) {
		case 'group':
			return initialObjectValue(field.children, isValues(fallback) ? fallback : {});
		case 'repeater': {
			if (Array.isArray(fallback)) {
				return fallback.map((item) => initialObjectValue(field.children, isValues(item) ? item : {}));
			}
			return Array.from({ length: field.schema.minItems ?? 0 }, () => initialObjectValue(field.children, {}));
		}
		case 'datetime':
			return typeof fallback === 'string' && dayjs(fallback).isValid()
				? dayjs(fallback).format(PICKER_DATETIME)
				: '';
		case 'time':
			return pickerTime(fallback);
		case 'switch':
		case 'checkbox':
			return typeof fallback === 'boolean' ? fallback : false;
		case 'multiselect':
		case 'checkbox-group':
			return Array.isArray(fallback) ? structuredClone(fallback) : [];
		case 'remote-select':
			return fallback !== undefined ? structuredClone(fallback) : field.options?.multiple ? [] : null;
		case 'select':
		case 'radio':
			return fallback ?? null;
		case 'file':
			// A file can't be a schema default; the filler always picks it.
			return field.file?.multiple ? [] : null;
		case 'json':
			return fallback !== undefined ? structuredClone(fallback) : undefined;
		default:
			return fallback ?? '';
	}
};

/** Starting state for `fields`, with `seed` (a default or a stored object) filling what it has. */
export const initialObjectValue = (fields: FormFieldModel[], seed: Values): Values => {
	const values: Values = {};
	for (const field of fields) {
		const own = seed[field.key];
		const value =
			own !== undefined
				? initialFieldValue({ ...field, schema: { ...field.schema, default: own } })
				: initialFieldValue(field);
		if (value !== undefined) values[field.key] = value;
	}
	return values;
};

export const initialFormValues = (model: FormModel, seed: Values = {}): Values =>
	initialObjectValue(model.fields, seed);

const fieldPayload = (field: FormFieldModel, value: unknown, path: string, root: Values): unknown => {
	switch (field.widget) {
		case 'group': {
			const object = objectPayload(field.children, isValues(value) ? value : {}, path, root);
			return Object.keys(object).length || field.required ? object : undefined;
		}
		case 'repeater': {
			const items = Array.isArray(value) ? value : [];
			const list = items.map((item, index) =>
				objectPayload(field.children, isValues(item) ? item : {}, joinValuePath(path, index), root),
			);
			return list.length || field.required ? list : undefined;
		}
		case 'switch':
		case 'checkbox':
			return typeof value === 'boolean' ? value : undefined;
		case 'number':
			return typeof value === 'number' ? value : isEmptyValue(value) ? undefined : Number(value);
		case 'datetime':
			return typeof value === 'string' && value ? dayjs(value).format() : undefined;
		case 'time':
			return payloadTime(value);
		case 'file':
			// Kept as File objects; the multipart body is built from them on delivery.
			if (field.file?.multiple) {
				const files = Array.isArray(value) ? value.filter((item) => item instanceof File) : [];
				return files.length ? files : undefined;
			}
			return value instanceof File ? value : undefined;
		case 'json':
			return value;
		default:
			return isEmptyValue(value) ? undefined : value;
	}
};

const objectPayload = (fields: FormFieldModel[], values: Values, prefix: string, root: Values): Values => {
	const object: Values = {};
	for (const field of fields) {
		const path = joinValuePath(prefix, field.key);
		if (!isFieldVisible(field, root, path)) continue;
		const value = fieldPayload(field, values[field.key], path, root);
		if (value !== undefined) object[field.key] = value;
	}
	return object;
};

/**
 * The payload to deliver: hidden fields pruned, optional fields left empty omitted, numbers as numbers and datetimes
 * and times as ISO 8601 / RFC 3339 with the filler's offset.
 */
export const buildFormPayload = (model: FormModel, values: Values): Values =>
	objectPayload(model.fields, values, '', values);
