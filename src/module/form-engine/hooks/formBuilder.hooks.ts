import { useMemo, useState } from 'react';

import type { FormBuilderState, FormBuilderTab } from '@module/form-engine/types/FormBuilderState';
import type { FormDraft } from '@module/form-engine/types/FormDraft';
import type { FormDraftField } from '@module/form-engine/types/FormDraftField';
import type { FormWidget } from '@module/form-engine/types/FormWidget';
import {
	type FormBuilderContainer,
	buildFormModel,
	containerFields,
	containerOf,
	draftContentTypeWarning,
	draftFromForm,
	draftIssues,
	findDraftField,
	formFromDraft,
	hasChildren,
	moveDraftField,
	newDraftField,
	uniqueKey,
	updateDraftField,
} from '@module/form-engine/utils';

/** Puts a new field at `index` of `container`, with a key unique among its siblings. */
const placeField = (
	draft: FormDraft,
	field: FormDraftField,
	container: FormBuilderContainer,
	index: number,
): FormDraft => {
	const siblings = container.type === 'children' ? containerFields(draft, container) : draft.fields;
	// Parked at the top level first, then moved into place, which also settles the section.
	const placed = { ...field, key: uniqueKey(siblings, field.key) };
	const parked = { ...draft, fields: [...draft.fields, { ...placed, key: uniqueKey(draft.fields, placed.key) }] };
	const moved = moveDraftField(parked, field.id, container, index);
	return { ...moved, fields: updateDraftField(moved.fields, field.id, (item) => ({ ...item, key: placed.key })) };
};

const pretty = (value: unknown) => JSON.stringify(value ?? {}, null, 2);

const snapshotOf = (draft: FormDraft) =>
	JSON.stringify({ name: draft.name.trim(), contentType: draft.contentType, ...formFromDraft(draft) });

const parseObject = (text: string, label: string, optional: boolean): Record<string, unknown> | undefined => {
	if (optional && !text.trim()) return undefined;
	const value: unknown = JSON.parse(text);
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error(`${label} must be a JSON object`);
	}
	return value as Record<string, unknown>;
};

/** Builder state for one form; `initial` is read once, so remount (via `key`) to load another. */
export const useFormBuilder = (initial: FormDraft, initialWarnings: string[] = []): FormBuilderState => {
	const [draft, setDraft] = useState(initial);
	// The draft as last saved (or loaded), for dirty checks and discarding.
	const [saved, setSaved] = useState(initial);
	const baseline = useMemo(() => snapshotOf(saved), [saved]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [tab, setTabState] = useState<FormBuilderTab>('build');
	const [parseWarnings, setParseWarnings] = useState(initialWarnings);
	const [json, setJsonState] = useState({ schema: '', ui: '' });
	const [jsonError, setJsonError] = useState<string | null>(null);

	const output = useMemo(() => formFromDraft(draft), [draft]);
	const model = useMemo(() => buildFormModel(output.schema, output.ui), [output]);
	const issues = draftIssues(draft);
	const contentTypeWarning = draftContentTypeWarning(draft);

	const setTab = (next: FormBuilderTab) => {
		// An invalid JSON edit can't become a draft, so it has to be fixed before leaving.
		if (tab === 'json' && jsonError) return;
		if (next === 'json') {
			setJsonState({ schema: pretty(output.schema), ui: output.ui ? pretty(output.ui) : '' });
			setJsonError(null);
		}
		setTabState(next);
	};

	const setJson = (part: 'schema' | 'ui', text: string) => {
		const next = { ...json, [part]: text };
		setJsonState(next);
		try {
			const schema = parseObject(next.schema, 'Schema', false)!;
			const ui = parseObject(next.ui, 'UI', true);
			const parsed = draftFromForm(draft.name, schema, ui, draft.contentType);
			setDraft(parsed.draft);
			setParseWarnings(parsed.warnings);
			setSelectedId(null);
			setJsonError(null);
		} catch (error) {
			setJsonError(error instanceof Error ? error.message : 'Invalid JSON');
		}
	};

	/**
	 * Adds into the selected group or repeater, else right after the selected field, else at the end: of the last
	 * section when the form has sections, since every field then has to be in one.
	 */
	const add = (widget: FormWidget) => {
		const field = newDraftField(widget, widget.replace('-', '_'));
		setDraft((current) => {
			let location = selectedId ? findDraftField(current.fields, selectedId) : null;
			// A file field only goes top level: next to the top-level field the selection sits in.
			if (widget === 'file') {
				while (location?.parent) location = findDraftField(current.fields, location.parent.id);
				if (location && hasChildren(location.field)) {
					const container = containerOf(current, location.field.id) ?? { type: 'ungrouped' as const };
					const list = containerFields(current, container);
					return placeField(current, field, container, list.indexOf(location.field) + 1);
				}
			}
			const lastSection = current.sections.at(-1);
			const container: FormBuilderContainer =
				location && hasChildren(location.field)
					? { type: 'children', id: location.field.id }
					: location
						? (containerOf(current, location.field.id) ?? { type: 'ungrouped' })
						: lastSection
							? { type: 'section', id: lastSection.id }
							: { type: 'ungrouped' };
			const list = containerFields(current, container);
			const after = location && !hasChildren(location.field) ? list.indexOf(location.field) : -1;
			return placeField(current, field, container, after >= 0 ? after + 1 : list.length);
		});
		setSelectedId(field.id);
	};

	const addAt = (widget: FormWidget, container: FormBuilderContainer, index: number) => {
		const field = newDraftField(widget, widget.replace('-', '_'));
		setDraft((current) => placeField(current, field, container, index));
		setSelectedId(field.id);
	};

	const selected = selectedId ? findDraftField(draft.fields, selectedId) : null;
	const addTarget = selected
		? hasChildren(selected.field)
			? `into ${selected.field.key}`
			: `after ${selected.field.key}`
		: 'at the end';

	return {
		draft,
		update: (fn) => setDraft((current) => fn(current)),
		selectedId,
		select: setSelectedId,
		add,
		addAt,
		addTarget,
		tab,
		setTab,
		json,
		setJson,
		jsonError,
		output,
		model,
		// Fields kept as JSON are listed once from the parse; the model adds `ui` problems of the current output.
		warnings: [
			...new Set([
				...parseWarnings,
				...model.warnings.filter((item) => !item.includes('edited as JSON')),
				...(contentTypeWarning ? [contentTypeWarning] : []),
			]),
		],
		issues,
		dirty: snapshotOf(draft) !== baseline,
		markSaved: () => setSaved(draft),
		discard: () => {
			setDraft(saved);
			setSelectedId(null);
			setJsonError(null);
			setTabState('build');
		},
	};
};
