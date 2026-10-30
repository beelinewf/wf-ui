import * as z from 'zod';

import { FORM_MAX_COLUMNS, FORM_UI_VERSION } from '@module/form-engine/constant';
import type { FormCondition } from '@module/form-engine/types/FormCondition';
import type { FormUi } from '@module/form-engine/types/FormUi';

const conditionOpSchema = z.enum(['eq', 'neq', 'in', 'notIn', 'empty', 'notEmpty', 'gt', 'lt']);

const conditionSchema: z.ZodType<FormCondition> = z.lazy(() =>
	z.union([
		z.object({ field: z.string().min(1), op: conditionOpSchema, value: z.unknown().optional() }),
		z.object({ all: z.array(conditionSchema) }),
		z.object({ any: z.array(conditionSchema) }),
	]),
);

const remoteOptionsSchema = z.object({
	url: z.string().min(1),
	method: z.enum(['GET', 'POST']),
	headers: z.record(z.string(), z.string()).optional(),
	body: z.unknown().optional(),
	itemsPath: z.string().optional(),
	valuePath: z.string(),
	labelPath: z.string(),
	search: z
		.object({
			minChars: z.number().int().min(0).optional(),
			debounceMs: z.number().int().min(0).optional(),
		})
		.optional(),
	multiple: z.boolean().optional(),
});

const widgetSchema = z.enum([
	'text',
	'textarea',
	'number',
	'switch',
	'checkbox',
	'select',
	'radio',
	'multiselect',
	'checkbox-group',
	'date',
	'datetime',
	'time',
	'group',
	'repeater',
	'remote-select',
	'file',
]);

const fieldUiSchema = z.object({
	widget: widgetSchema.optional(),
	label: z.string().optional(),
	placeholder: z.string().optional(),
	help: z.string().optional(),
	colSpan: z.number().int().min(1).max(FORM_MAX_COLUMNS).optional(),
	visibleWhen: conditionSchema.optional(),
	groupStyle: z.enum(['default', 'filled', 'dotted', 'unstyled', 'card']).optional(),
	order: z.array(z.string()).optional(),
	options: remoteOptionsSchema.optional(),
});

export const formUiSchema = z.object({
	version: z.literal(FORM_UI_VERSION),
	order: z.array(z.string()).optional(),
	layout: z
		.object({
			columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
			sectionStyle: z.enum(['long', 'stepper', 'accordion']).optional(),
		})
		.optional(),
	sections: z
		.array(
			z.object({
				id: z.string().min(1),
				title: z.string(),
				description: z.string().optional(),
				fields: z.array(z.string()),
			}),
		)
		.optional(),
	fields: z.record(z.string(), fieldUiSchema).optional(),
}) satisfies z.ZodType<FormUi>;

export interface FormUiParseResult {
	/** Null when there is no `ui` or it can't be read; the form then renders from its schema alone. */
	ui: FormUi | null;
	/** Why `ui` was ignored, for the builder to show. Empty when it parsed or was absent. */
	warnings: string[];
}

/** Reads a stored `ui`. Never throws: a form must render even when its `ui` is broken. */
export const parseFormUi = (raw: unknown): FormUiParseResult => {
	if (raw === undefined || raw === null) return { ui: null, warnings: [] };

	if (typeof raw === 'object' && !Array.isArray(raw) && 'version' in raw && raw.version !== FORM_UI_VERSION) {
		return {
			ui: null,
			warnings: [`ui version ${String(raw.version)} isn't supported (expected ${FORM_UI_VERSION}); it's ignored`],
		};
	}

	const parsed = formUiSchema.safeParse(raw);
	if (parsed.success) return { ui: parsed.data, warnings: [] };

	return {
		ui: null,
		warnings: parsed.error.issues.map((issue) =>
			issue.path.length ? `ui.${issue.path.join('.')}: ${issue.message}` : `ui: ${issue.message}`,
		),
	};
};
