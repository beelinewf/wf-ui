import { FORM_ITEM_SEGMENT } from '@module/form-engine/constant';
import type { FormBuilderFieldTab } from '@module/form-engine/types/FormBuilderInspectorTab';
import type { FormCondition } from '@module/form-engine/types/FormCondition';
import type { FormDraft } from '@module/form-engine/types/FormDraft';
import type { FormDraftField, FormDraftInputField } from '@module/form-engine/types/FormDraftField';
import type { FormWidget } from '@module/form-engine/types/FormWidget';

import { isListWidget, newDraftField } from './form.draft';
import { FORM_MIME_TYPE_PATTERN } from './form.file';

/** Property keys the builder writes: an identifier, so paths and `{{ field.x }}` templates stay unambiguous. */
export const FORM_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** A drop target of the field tree: the ungrouped top level, a section, or a group/repeater's children. */
export type FormBuilderContainer =
	| { type: 'ungrouped' }
	| { type: 'section'; id: string }
	| { type: 'children'; id: string };

export const containerId = (container: FormBuilderContainer) =>
	container.type === 'ungrouped' ? 'ungrouped' : `${container.type}:${container.id}`;

export const parseContainerId = (id: string): FormBuilderContainer | null => {
	if (id === 'ungrouped') return { type: 'ungrouped' };
	const [type, ...rest] = id.split(':');
	if ((type === 'section' || type === 'children') && rest.length) return { type, id: rest.join(':') };
	return null;
};

export const hasChildren = (field: FormDraftField): field is FormDraftInputField =>
	field.kind === 'input' && (field.widget === 'group' || field.widget === 'repeater');

export interface FormDraftLocation {
	field: FormDraftField;
	/** The group or repeater holding it; null at the top level. */
	parent: FormDraftInputField | null;
	siblings: FormDraftField[];
	index: number;
	/** Value path with `*` for repeater items, as `ui.fields` and conditions use it. */
	path: string;
}

const childPrefix = (field: FormDraftInputField, path: string) =>
	field.widget === 'repeater' ? `${path}.${FORM_ITEM_SEGMENT}` : path;

/** Every field in display order, with where it sits. */
export const walkDraft = (fields: FormDraftField[]): FormDraftLocation[] => {
	const out: FormDraftLocation[] = [];
	const visit = (list: FormDraftField[], parent: FormDraftInputField | null, prefix: string) => {
		list.forEach((field, index) => {
			const path = prefix ? `${prefix}.${field.key}` : field.key;
			out.push({ field, parent, siblings: list, index, path });
			if (hasChildren(field)) visit(field.children, field, childPrefix(field, path));
		});
	};
	visit(fields, null, '');
	return out;
};

export const findDraftField = (fields: FormDraftField[], id: string) =>
	walkDraft(fields).find((location) => location.field.id === id) ?? null;

const mapFields = (fields: FormDraftField[], fn: (field: FormDraftField) => FormDraftField): FormDraftField[] =>
	fields.map((field) => {
		const next = fn(field);
		return hasChildren(next) ? { ...next, children: mapFields(next.children, fn) } : next;
	});

export const updateDraftField = (
	fields: FormDraftField[],
	id: string,
	update: (field: FormDraftField) => FormDraftField,
): FormDraftField[] => mapFields(fields, (field) => (field.id === id ? update(field) : field));

const removeById = (fields: FormDraftField[], id: string): FormDraftField[] =>
	fields
		.filter((field) => field.id !== id)
		.map((field) => (hasChildren(field) ? { ...field, children: removeById(field.children, id) } : field));

/** A key not used by `siblings`: `base`, else `base_2`, `base_3`… */
export const uniqueKey = (siblings: FormDraftField[], base: string, except?: string) => {
	const taken = new Set(siblings.filter((field) => field.id !== except).map((field) => field.key));
	if (!taken.has(base)) return base;
	let index = 2;
	while (taken.has(`${base}_${index}`)) index += 1;
	return `${base}_${index}`;
};

const rewriteCondition = (condition: FormCondition, from: string, to: string): FormCondition => {
	if ('all' in condition) return { all: condition.all.map((item) => rewriteCondition(item, from, to)) };
	if ('any' in condition) return { any: condition.any.map((item) => rewriteCondition(item, from, to)) };
	if (condition.field === from) return { ...condition, field: to };
	if (condition.field.startsWith(`${from}.`)) return { ...condition, field: to + condition.field.slice(from.length) };
	return condition;
};

/** Points conditions at a field's new path after it was renamed or moved. */
const rewritePaths = (fields: FormDraftField[], from: string, to: string) =>
	from === to
		? fields
		: mapFields(fields, (field) =>
				field.kind === 'input' && field.visibleWhen
					? { ...field, visibleWhen: rewriteCondition(field.visibleWhen, from, to) }
					: field,
			);

const withoutKeyInSections = (draft: FormDraft, key: string) =>
	draft.sections.map((section) => ({ ...section, fields: section.fields.filter((item) => item !== key) }));

/** Renames a field, keeping sections and conditions pointing at it. */
export const renameDraftField = (draft: FormDraft, id: string, key: string): FormDraft => {
	const location = findDraftField(draft.fields, id);
	if (!location || location.field.key === key) return draft;
	const oldPath = location.path;
	const newPath = oldPath.slice(0, oldPath.length - location.field.key.length) + key;

	const fields = updateDraftField(draft.fields, id, (field) => ({ ...field, key }));
	return {
		...draft,
		fields: rewritePaths(fields, oldPath, newPath),
		sections: location.parent
			? draft.sections
			: draft.sections.map((section) => ({
					...section,
					fields: section.fields.map((item) => (item === location.field.key ? key : item)),
				})),
	};
};

export const removeDraftField = (draft: FormDraft, id: string): FormDraft => {
	const location = findDraftField(draft.fields, id);
	if (!location) return draft;
	return {
		...draft,
		fields: removeById(draft.fields, id),
		sections: location.parent ? draft.sections : withoutKeyInSections(draft, location.field.key),
	};
};

/** Top-level fields shown in `container`, in display order. */
export const containerFields = (draft: FormDraft, container: FormBuilderContainer): FormDraftField[] => {
	if (container.type === 'children') {
		const location = findDraftField(draft.fields, container.id);
		return location && hasChildren(location.field) ? location.field.children : [];
	}
	if (container.type === 'section') {
		const section = draft.sections.find((item) => item.id === container.id);
		const byKey = new Map(draft.fields.map((field) => [field.key, field]));
		return (section?.fields ?? []).flatMap((key) => byKey.get(key) ?? []);
	}
	const claimed = new Set(draft.sections.flatMap((section) => section.fields));
	return draft.fields.filter((field) => !claimed.has(field.key));
};

/** The container a field is shown in. */
export const containerOf = (draft: FormDraft, id: string): FormBuilderContainer | null => {
	const location = findDraftField(draft.fields, id);
	if (!location) return null;
	if (location.parent) return { type: 'children', id: location.parent.id };
	const section = draft.sections.find((item) => item.fields.includes(location.field.key));
	return section ? { type: 'section', id: section.id } : { type: 'ungrouped' };
};

/** Whether `id` can go into `container`: never into itself or its own descendants, and a file field only top level. */
export const canDropInto = (draft: FormDraft, id: string, container: FormBuilderContainer) => {
	if (container.type !== 'children') return true;
	if (container.id === id) return false;
	const location = findDraftField(draft.fields, id);
	if (location?.field.kind === 'input' && location.field.widget === 'file') return false;
	if (!location || !hasChildren(location.field)) return true;
	return !walkDraft(location.field.children).some((item) => item.field.id === container.id);
};

/**
 * Moves a field to `index` within `container`. A key that clashes with its new siblings gets a suffix, and
 * conditions follow the field to its new path.
 */
export const moveDraftField = (
	draft: FormDraft,
	id: string,
	container: FormBuilderContainer,
	index: number,
): FormDraft => {
	const location = findDraftField(draft.fields, id);
	if (!location || !canDropInto(draft, id, container)) return draft;

	// Take the field out of wherever it is.
	let next: FormDraft = removeDraftField(draft, id);
	const moving = location.field;

	if (container.type === 'children') {
		const target = findDraftField(next.fields, container.id);
		if (!target || !hasChildren(target.field)) return draft;
		const key = uniqueKey(target.field.children, moving.key);
		const placed = { ...moving, key };
		next = {
			...next,
			fields: updateDraftField(next.fields, container.id, (field) => {
				const parent = field as FormDraftInputField;
				const children = [...parent.children];
				children.splice(Math.min(index, children.length), 0, placed);
				return { ...parent, children };
			}),
		};
		const newPath = `${childPrefix(target.field, target.path)}.${key}`;
		return { ...next, fields: rewritePaths(next.fields, location.path, newPath) };
	}

	// Top level: the field joins `fields`, then its section membership is set.
	const key = location.parent ? uniqueKey(next.fields, moving.key) : moving.key;
	const placed = { ...moving, key };
	const visible = containerFields(next, container);
	const anchor = visible[index];
	const fields = [...next.fields];
	if (anchor) fields.splice(fields.indexOf(anchor), 0, placed);
	else if (visible.length) fields.splice(fields.indexOf(visible[visible.length - 1]) + 1, 0, placed);
	else fields.push(placed);

	const sections =
		container.type === 'section'
			? next.sections.map((section) => {
					if (section.id !== container.id) return section;
					const members = [...section.fields];
					members.splice(Math.min(index, members.length), 0, key);
					return { ...section, fields: members };
				})
			: next.sections;

	return { ...next, fields: rewritePaths(fields, location.path, key), sections };
};

/** Fields a condition can test: every input field except `self` and anything inside it. */
export const conditionTargets = (draft: FormDraft, selfId: string) => {
	const self = findDraftField(draft.fields, selfId);
	return walkDraft(draft.fields).filter(
		(location) =>
			location.field.kind === 'input' &&
			location.field.id !== selfId &&
			!hasChildren(location.field) &&
			!(self && location.path.startsWith(`${self.path}.`)),
	);
};

const WIDGET_FAMILY: Record<FormWidget, string> = {
	text: 'text',
	textarea: 'text',
	date: 'date',
	datetime: 'date',
	time: 'date',
	number: 'number',
	switch: 'boolean',
	checkbox: 'boolean',
	select: 'choice',
	radio: 'choice',
	multiselect: 'choice',
	'checkbox-group': 'choice',
	group: 'object',
	repeater: 'object',
	'remote-select': 'remote',
	file: 'file',
};

/**
 * `field` switched to `widget`. Shared settings (key, label, help, required, condition, width) always carry over;
 * options carry between choice widgets, children between group and repeater, rules within a family.
 */
export const changeDraftWidget = (field: FormDraftInputField, widget: FormWidget): FormDraftInputField => {
	if (field.widget === widget) return field;
	const fresh = newDraftField(widget, field.key);
	const sameFamily = WIDGET_FAMILY[field.widget] === WIDGET_FAMILY[widget];
	const wasList = isListWidget(field.widget);
	const isList = isListWidget(widget);

	return {
		...fresh,
		id: field.id,
		required: field.required,
		label: field.label,
		help: field.help,
		placeholder: field.placeholder,
		colSpan: field.colSpan,
		visibleWhen: field.visibleWhen,
		extra: field.extra,
		valueType: sameFamily ? field.valueType : fresh.valueType,
		enumValues: sameFamily && field.enumValues.length ? field.enumValues : fresh.enumValues,
		constraints: sameFamily ? field.constraints : {},
		// A single value and a list don't share a default.
		default: sameFamily && wasList === isList ? field.default : undefined,
		children: sameFamily ? field.children : [],
		strict: sameFamily ? field.strict : false,
		groupStyle: sameFamily ? field.groupStyle : undefined,
	};
};

/** Whether the draft has a file field anywhere; only top-level ones are valid, but any one needs multipart. */
export const draftHasFileFields = (draft: FormDraft) =>
	walkDraft(draft.fields).some(({ field }) => field.kind === 'input' && field.widget === 'file');

/** Why the content type doesn't fit the fields, or null. A warning only: the content type is set by hand. */
export const draftContentTypeWarning = (draft: FormDraft): string | null => {
	const files = draftHasFileFields(draft);
	const multipart = draft.contentType === 'multipart/form-data';
	if (files && !multipart) {
		return 'The form has file fields but its content type is JSON; files only go out as multipart';
	}
	if (!files && multipart) {
		return 'The content type is multipart but there are no file fields; JSON keeps value types';
	}
	return null;
};

/** What blocks saving: missing names, fields outside a sectioned form's sections, bad keys, empty option lists, remote selects without a URL. */
export const draftIssues = (draft: FormDraft): string[] => {
	const issues: string[] = [];
	if (!draft.name.trim()) issues.push('Give the form a name');
	if (draft.fields.length === 0) issues.push('Add at least one field');
	if (draft.sections.length) {
		const placed = new Set(draft.sections.flatMap((section) => section.fields));
		for (const field of draft.fields) {
			if (!placed.has(field.key)) issues.push(`${field.key}: put it in a section`);
		}
	}
	for (const { field, parent, siblings, path } of walkDraft(draft.fields)) {
		if (!FORM_KEY_PATTERN.test(field.key)) {
			issues.push(`${path}: key must start with a letter or _ and use letters, digits and _ only`);
		}
		if (siblings.filter((item) => item.key === field.key).length > 1) issues.push(`${path}: key is used twice`);
		if (field.kind !== 'input') continue;
		if (['select', 'radio', 'multiselect', 'checkbox-group'].includes(field.widget) && !field.enumValues.length) {
			issues.push(`${path}: add at least one option`);
		}
		if (field.widget === 'remote-select' && !field.options?.url.trim()) issues.push(`${path}: set the request URL`);
		if (hasChildren(field) && field.children.length === 0) issues.push(`${path}: add at least one field inside`);
		if (field.widget === 'file') {
			if (parent) issues.push(`${path}: file fields must be top level, not inside a group or repeater`);
			for (const type of field.constraints.allowedMimeTypes ?? []) {
				if (!FORM_MIME_TYPE_PATTERN.test(type))
					issues.push(`${path}: "${type}" isn't a MIME type like image/png or image/*`);
			}
			const max = field.constraints.maxFileBytes;
			if (max !== undefined && (!Number.isInteger(max) || max <= 0)) {
				issues.push(`${path}: max file size must be more than 0`);
			}
		}
		if (field.constraints.pattern) {
			try {
				new RegExp(field.constraints.pattern, 'u');
			} catch {
				issues.push(`${path}: pattern isn't a valid regular expression`);
			}
		}
	}
	return [...new Set(issues)];
};

/** The inspector tabs `field` has something to show in; a raw field only has General. */
export const draftFieldTabs = (draft: FormDraft, field: FormDraftField): FormBuilderFieldTab[] => {
	if (field.kind === 'raw') return ['general'];
	const topLevel = !findDraftField(draft.fields, field.id)?.parent;
	const style = draft.columns > 1 || (topLevel && draft.sections.length > 0) || hasChildren(field);
	return [
		'general',
		...(hasChildren(field) ? [] : (['data'] as const)),
		'validation',
		...(style ? (['style'] as const) : []),
		'logic',
	];
};
