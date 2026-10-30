import { isEqual } from 'es-toolkit';
import * as z from 'zod';

import type { JsonSchema } from '@common/types/JsonSchema';

import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';
import type { FormModel } from '@module/form-engine/types/FormModel';

import { isFieldVisible } from './form.condition';
import { formIssuesToErrors } from './form.error';
import { formatFileSize, matchesMimeType } from './form.file';
import { joinValuePath } from './form.model';

type Values = Record<string, unknown>;

/** For a wrong type: "Required" when the key is missing, else `message`. Other issues keep zod's own message. */
const required = (message: string) => (issue: { code?: string; input?: unknown }) => {
	if (issue.code !== 'invalid_type') return undefined;
	return issue.input === undefined ? 'Required' : message;
};

/** RFC 3339 `full-time`, as JSON Schema's `format: time` asks: seconds and an offset included. */
const FULL_TIME = /^([01]\d|2[0-3]):[0-5]\d:([0-5]\d|60)(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/i;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const stringSchema = (schema: JsonSchema) => {
	const error = required('Must be text');
	let base: z.ZodString | z.ZodStringFormat;
	switch (schema.format) {
		case 'email':
			base = z.email({ error: required('Enter a valid email address') });
			break;
		case 'uri':
			base = z.url({ error: required('Enter a valid URL') });
			break;
		case 'date':
			base = z.iso.date({ error: required('Enter a valid date') });
			break;
		case 'date-time':
			base = z.iso.datetime({ offset: true, error: required('Enter a valid date and time') });
			break;
		case 'time':
			base = z.string({ error: required('Enter a valid time') }).regex(FULL_TIME, 'Enter a valid time');
			break;
		default:
			base = z.string({ error });
	}
	if (schema.minLength !== undefined) {
		base = base.min(schema.minLength, `At least ${plural(schema.minLength, 'character')}`);
	}
	if (schema.maxLength !== undefined) {
		base = base.max(schema.maxLength, `At most ${plural(schema.maxLength, 'character')}`);
	}
	if (schema.pattern) {
		try {
			base = base.regex(new RegExp(schema.pattern, 'u'), `Must match ${schema.pattern}`);
		} catch {
			// An invalid pattern can't be checked here; the builder flags it.
		}
	}
	return base;
};

const numberSchema = (schema: JsonSchema, integer: boolean) => {
	let base = integer
		? z.int({ error: required('Must be a whole number') })
		: z.number({ error: required('Must be a number') });
	if (schema.minimum !== undefined) base = base.gte(schema.minimum, `Must be at least ${schema.minimum}`);
	if (schema.maximum !== undefined) base = base.lte(schema.maximum, `Must be at most ${schema.maximum}`);
	if (schema.exclusiveMinimum !== undefined) {
		base = base.gt(schema.exclusiveMinimum, `Must be more than ${schema.exclusiveMinimum}`);
	}
	if (schema.exclusiveMaximum !== undefined) {
		base = base.lt(schema.exclusiveMaximum, `Must be less than ${schema.exclusiveMaximum}`);
	}
	if (schema.multipleOf !== undefined) {
		base = base.multipleOf(schema.multipleOf, `Must be a multiple of ${schema.multipleOf}`);
	}
	return base;
};

const enumSchema = (values: unknown[]) =>
	z.unknown().refine((value) => value !== undefined && values.some((option) => isEqual(option, value)), {
		error: (issue) => (issue.input === undefined ? 'Required' : 'Pick one of the options'),
	});

/** `minItems`, `maxItems` and `uniqueItems` of an array field, applied to any array schema. */
const arrayRules = <T extends z.ZodType<unknown[]>>(base: T, schema: JsonSchema) =>
	base.check(
		z.superRefine((list: unknown[], ctx) => {
			if (schema.minItems !== undefined && list.length < schema.minItems) {
				ctx.addIssue({ code: 'custom', message: `Add at least ${plural(schema.minItems, 'item')}` });
			}
			if (schema.maxItems !== undefined && list.length > schema.maxItems) {
				ctx.addIssue({ code: 'custom', message: `At most ${plural(schema.maxItems, 'item')}` });
			}
			if (
				schema.uniqueItems &&
				list.some((item, index) => list.findIndex((other) => isEqual(other, item)) !== index)
			) {
				ctx.addIssue({ code: 'custom', message: 'Items must be unique' });
			}
		}),
	);

/** One picked file, checked against the field's size and type rules as the engine checks them. */
const fileSchema = (field: FormFieldModel) => {
	const { accept = [], maxBytes } = field.file ?? {};
	return z
		.custom<File>((input) => input instanceof File, {
			error: (issue) => (issue.input === undefined || issue.input === null ? 'Required' : 'Choose a file'),
		})
		.check(
			z.superRefine((file: File, ctx) => {
				if (maxBytes !== undefined && file.size > maxBytes) {
					ctx.addIssue({ code: 'custom', message: `${file.name} is over ${formatFileSize(maxBytes)}` });
				}
				if (accept.length && !matchesMimeType(file.type, accept)) {
					ctx.addIssue({
						code: 'custom',
						message: `${file.name} isn't an allowed type (${accept.join(', ')})`,
					});
				}
			}),
		);
};

/** A remote option's value, by the schema type it's stored as. */
const remoteValueSchema = (type: unknown, message: string): z.ZodType => {
	const error = required(message);
	switch (type) {
		case 'integer':
			return z.int({ error });
		case 'number':
			return z.number({ error });
		case 'string':
			return z.string({ error });
		default:
			return z.union([z.string(), z.number()], {
				error: (issue) => (issue.input === undefined ? 'Required' : message),
			});
	}
};

const schemaType = (schema: JsonSchema | undefined) =>
	(Array.isArray(schema?.type) ? schema.type.find((item) => item !== 'null') : schema?.type) ?? '';

const fieldSchema = (field: FormFieldModel, value: unknown, path: string, root: Values): z.ZodType => {
	const { schema } = field;
	const type = schemaType(schema);

	switch (field.widget) {
		case 'group':
			return objectSchema(field.children, field.strict, value, path, root);
		case 'repeater': {
			const list = Array.isArray(value) ? value : [];
			// One schema per item: visibility inside an item can differ between items.
			const items = z.tuple(
				list.map((item, index) =>
					objectSchema(field.children, field.strict, item, joinValuePath(path, index), root),
				) as [z.ZodType, ...z.ZodType[]],
			);
			return arrayRules(z.array(z.unknown(), { error: required('Must be a list') }), schema).pipe(items);
		}
		case 'remote-select':
			// Validated by type only; the fetched options aren't known here.
			return type === 'array'
				? arrayRules(
						z.array(
							remoteValueSchema(schemaType(schema.items as JsonSchema | undefined), 'Pick an option'),
							{
								error: required('Pick at least one option'),
							},
						),
						schema,
					)
				: remoteValueSchema(type, 'Pick an option');
		case 'multiselect':
		case 'checkbox-group': {
			const options = (field.schema.items as JsonSchema | undefined)?.enum ?? [];
			return arrayRules(z.array(enumSchema(options), { error: required('Must be a list') }), schema);
		}
		case 'select':
		case 'radio':
			return enumSchema(schema.enum ?? []);
		case 'file':
			return field.file?.multiple
				? arrayRules(z.array(fileSchema(field), { error: required('Add at least one file') }), schema)
				: fileSchema(field);
		case 'json':
			return z.unknown().refine((input) => input !== undefined, 'Required');
		case 'switch':
		case 'checkbox':
			return z.boolean({ error: required('Must be true or false') });
		case 'number':
			return numberSchema(schema, type === 'integer');
		default:
			return schema.enum ? enumSchema(schema.enum) : stringSchema(schema);
	}
};

const objectSchema = (
	fields: FormFieldModel[],
	strict: boolean,
	value: unknown,
	prefix: string,
	root: Values,
): z.ZodType => {
	const values = (typeof value === 'object' && value !== null ? value : {}) as Values;
	const shape: Record<string, z.ZodType> = {};
	for (const field of fields) {
		const path = joinValuePath(prefix, field.key);
		// A hidden field is pruned from the payload, so it is neither required nor checked.
		if (!isFieldVisible(field, root, path)) continue;
		const own = fieldSchema(field, values[field.key], path, root);
		shape[field.key] = field.required ? own : own.optional();
	}
	const error = required('Must be an object');
	return strict ? z.strictObject(shape, { error }) : z.looseObject(shape, { error });
};

/**
 * The zod schema for one payload of the form. Visibility depends on the payload itself, so the schema is compiled
 * per check; at form sizes that's cheap.
 */
export const compileFormSchema = (model: FormModel, payload: Values) =>
	objectSchema(model.fields, model.strict, payload, '', payload);

export interface FormValidationResult {
	success: boolean;
	/** By dotted path; empty on success. */
	errors: Record<string, string>;
}

export const validateFormPayload = (model: FormModel, payload: unknown): FormValidationResult => {
	const values = (
		typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? payload : {}
	) as Values;
	const result = compileFormSchema(model, values).safeParse(payload);
	return result.success
		? { success: true, errors: {} }
		: { success: false, errors: formIssuesToErrors(result.error.issues) };
};
