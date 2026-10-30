import { get, isEqual } from 'es-toolkit/compat';

import { FORM_ITEM_SEGMENT } from '@module/form-engine/constant';
import type { FormCondition } from '@module/form-engine/types/FormCondition';
import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';

/** No value at all: unset, blank text, an empty list or an empty object. `false` and `0` are values. */
export const isEmptyValue = (value: unknown) =>
	value === undefined ||
	value === null ||
	value === '' ||
	(Array.isArray(value) && value.length === 0) ||
	(typeof value === 'object' && !Array.isArray(value) && !(value instanceof Blob) && Object.keys(value).length === 0);

/**
 * A condition's field path made concrete for the field being evaluated: each `*` takes the item index at the same
 * position of `at`, so `items.*.kind` read from `items.2.sku` means `items.2.kind`.
 */
export const resolveConditionPath = (field: string, at: string) => {
	const atSegments = at.split('.');
	return field
		.split('.')
		.map((segment, index) => (segment === FORM_ITEM_SEGMENT ? (atSegments[index] ?? segment) : segment))
		.join('.');
};

const asNumber = (value: unknown) => (typeof value === 'number' ? value : value === '' ? NaN : Number(value));

/** Whether `condition` holds against the form `values`, for the field at concrete path `at`. */
export const evaluateCondition = (condition: FormCondition, values: unknown, at = ''): boolean => {
	if ('all' in condition) return condition.all.every((item) => evaluateCondition(item, values, at));
	if ('any' in condition) return condition.any.some((item) => evaluateCondition(item, values, at));

	const actual = get(values, resolveConditionPath(condition.field, at));
	const expected = condition.value;
	const list = Array.isArray(expected) ? expected : [expected];
	switch (condition.op) {
		case 'eq':
			return isEqual(actual, expected);
		case 'neq':
			return !isEqual(actual, expected);
		case 'in':
			return Array.isArray(actual)
				? actual.some((item) => list.some((entry) => isEqual(item, entry)))
				: list.some((entry) => isEqual(actual, entry));
		case 'notIn':
			return Array.isArray(actual)
				? !actual.some((item) => list.some((entry) => isEqual(item, entry)))
				: !list.some((entry) => isEqual(actual, entry));
		case 'empty':
			return isEmptyValue(actual);
		case 'notEmpty':
			return !isEmptyValue(actual);
		case 'gt':
			return asNumber(actual) > asNumber(expected);
		case 'lt':
			return asNumber(actual) < asNumber(expected);
	}
};

/** A field with no `visibleWhen` is always shown. Ancestors are checked by the caller as it walks the tree. */
export const isFieldVisible = (field: FormFieldModel, values: unknown, at: string) =>
	!field.visibleWhen || evaluateCondition(field.visibleWhen, values, at);
