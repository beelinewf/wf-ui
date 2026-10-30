import React from 'react';

import {
	Button,
	Fieldset,
	Group,
	MultiSelect,
	NumberInput,
	SegmentedControl,
	Select,
	Stack,
	Switch,
	TagsInput,
	Text,
	Textarea,
	TextInput,
} from '@mantine/core';
import { LuBraces } from 'react-icons/lu';

import { CodeEditor } from '@common/component/CodeEditor';

import { FormBuilderRemoteEditor } from '@module/form-engine/components/FormBuilderRemoteEditor';
import { FORM_GROUP_STYLE_LABELS, FORM_WIDGET_LABELS } from '@module/form-engine/constant';
import type { FormBuilderFieldTab } from '@module/form-engine/types/FormBuilderInspectorTab';
import type { FormBuilderState } from '@module/form-engine/types/FormBuilderState';
import type {
	FormDraftConstraints,
	FormDraftField,
	FormDraftInputField,
	FormDraftValueType,
} from '@module/form-engine/types/FormDraftField';
import type { FormGroupStyle } from '@module/form-engine/types/FormGroupStyle';
import type { FormWidget } from '@module/form-engine/types/FormWidget';
import {
	FORM_KEY_PATTERN,
	changeDraftWidget,
	conditionTargets,
	containerOf,
	findDraftField,
	hasChildren,
	isListWidget,
	moveDraftField,
	containerFields,
	renameDraftField,
	updateDraftField,
} from '@module/form-engine/utils';

import { FormBuilderConditionEditor } from './FormBuilderConditionEditor';

const CHOICE_WIDGETS: ReadonlySet<FormWidget> = new Set(['select', 'radio', 'multiselect', 'checkbox-group']);
const NO_PLACEHOLDER: ReadonlySet<FormWidget> = new Set([
	'switch',
	'checkbox',
	'radio',
	'checkbox-group',
	'group',
	'repeater',
	'file',
]);

const BYTES_PER_MB = 1024 * 1024;

const optionalNumber = (value: string | number) => (typeof value === 'number' ? value : undefined);

/** Option values typed in as text, cast to the field's value type. */
const castOptions = (values: string[], type: FormDraftValueType) =>
	type === 'number' || type === 'integer'
		? values.map(Number).filter((value) => !Number.isNaN(value) && (type === 'number' || Number.isInteger(value)))
		: values;

const DefaultInput: React.FC<{ field: FormDraftInputField; onChange: (value: unknown) => void }> = ({
	field,
	onChange,
}) => {
	const value = field.default;
	const options = field.enumValues.map(String);
	const fromOption = (key: string) => field.enumValues.find((option) => String(option) === key);
	const common = { label: 'Default', size: 'xs' as const };

	switch (field.widget) {
		case 'group':
		case 'repeater':
		case 'remote-select':
		case 'file':
			return null;
		case 'switch':
		case 'checkbox':
			return (
				<Select
					{...common}
					placeholder="None"
					clearable
					data={['true', 'false']}
					value={typeof value === 'boolean' ? String(value) : null}
					onChange={(next) => onChange(next === null ? undefined : next === 'true')}
				/>
			);
		case 'select':
		case 'radio':
			return (
				<Select
					{...common}
					placeholder="None"
					clearable
					data={options}
					value={value === undefined ? null : String(value)}
					onChange={(next) => onChange(next === null ? undefined : fromOption(next))}
				/>
			);
		case 'multiselect':
		case 'checkbox-group':
			return (
				<MultiSelect
					{...common}
					placeholder="None"
					data={options}
					value={Array.isArray(value) ? value.map(String) : []}
					onChange={(next) => onChange(next.length ? next.map(fromOption) : undefined)}
				/>
			);
		case 'number':
			return (
				<NumberInput
					{...common}
					placeholder="None"
					value={typeof value === 'number' ? value : ''}
					onChange={(next) => onChange(optionalNumber(next))}
				/>
			);
		default:
			return (
				<TextInput
					{...common}
					placeholder={
						field.widget === 'date'
							? 'YYYY-MM-DD'
							: field.widget === 'datetime'
								? '2026-01-31T09:00:00+07:00'
								: field.widget === 'time'
									? 'HH:mm'
									: 'None'
					}
					value={typeof value === 'string' ? value : ''}
					onChange={(event) => onChange(event.currentTarget.value || undefined)}
				/>
			);
	}
};

const ConstraintInputs: React.FC<{
	field: FormDraftInputField;
	onChange: (patch: Partial<FormDraftConstraints>) => void;
}> = ({ field, onChange }) => {
	const rules = field.constraints;
	const number = (label: string, key: keyof FormDraftConstraints, min?: number) => (
		<NumberInput
			size="xs"
			label={label}
			min={min}
			value={typeof rules[key] === 'number' ? (rules[key] as number) : ''}
			onChange={(next) => onChange({ [key]: optionalNumber(next) })}
		/>
	);
	const listRules = isListWidget(field.widget) || field.widget === 'repeater' || !!field.options?.multiple;

	if (field.widget === 'file') {
		const maxBytes = rules.maxFileBytes;
		return (
			<Stack gap={6}>
				<TagsInput
					size="xs"
					label="Allowed types"
					description="MIME types like application/pdf or image/*; none allows any"
					placeholder="image/*"
					value={rules.allowedMimeTypes ?? []}
					onChange={(next) => onChange({ allowedMimeTypes: next.length ? next : undefined })}
				/>
				<NumberInput
					size="xs"
					label="Max size per file"
					description="The engine also caps every file and the whole upload"
					suffix=" MB"
					min={0}
					decimalScale={2}
					value={maxBytes === undefined ? '' : Number((maxBytes / BYTES_PER_MB).toFixed(2))}
					onChange={(next) =>
						onChange({
							maxFileBytes: typeof next === 'number' ? Math.round(next * BYTES_PER_MB) : undefined,
						})
					}
				/>
				{field.multiple && (
					<Group grow gap={6}>
						{number('Min files', 'minItems', 0)}
						{number('Max files', 'maxItems', 0)}
					</Group>
				)}
			</Stack>
		);
	}

	if (field.widget === 'text' || field.widget === 'textarea') {
		return (
			<Stack gap={6}>
				<Select
					size="xs"
					label="Format"
					data={[
						{ value: '', label: 'Any text' },
						{ value: 'email', label: 'Email' },
						{ value: 'uri', label: 'URL' },
					]}
					value={rules.format ?? ''}
					allowDeselect={false}
					onChange={(next) => onChange({ format: (next || undefined) as FormDraftConstraints['format'] })}
				/>
				<Group grow gap={6}>
					{number('Min length', 'minLength', 0)}
					{number('Max length', 'maxLength', 0)}
				</Group>
				<TextInput
					size="xs"
					label="Pattern"
					placeholder="^[A-Z]{3}$"
					ff="monospace"
					value={rules.pattern ?? ''}
					onChange={(event) => onChange({ pattern: event.currentTarget.value || undefined })}
				/>
			</Stack>
		);
	}
	if (field.widget === 'number') {
		return (
			<Stack gap={6}>
				<Group grow gap={6}>
					{number('Minimum', 'minimum')}
					{number('Maximum', 'maximum')}
				</Group>
				<Group grow gap={6}>
					{number('More than', 'exclusiveMinimum')}
					{number('Less than', 'exclusiveMaximum')}
				</Group>
				{number('Multiple of', 'multipleOf', 0)}
			</Stack>
		);
	}
	if (listRules) {
		return (
			<Stack gap={6}>
				<Group grow gap={6}>
					{number('Min items', 'minItems', 0)}
					{number('Max items', 'maxItems', 0)}
				</Group>
				<Switch
					size="xs"
					label="Items must be unique"
					checked={!!rules.uniqueItems}
					onChange={(event) => onChange({ uniqueItems: event.currentTarget.checked || undefined })}
				/>
			</Stack>
		);
	}
	return null;
};

interface FormBuilderFieldPanelProps {
	builder: FormBuilderState;
	field: FormDraftField;
	tab: FormBuilderFieldTab;
	readOnly: boolean;
}

/** The selected field's settings on `tab`. */
export const FormBuilderFieldPanel: React.FC<FormBuilderFieldPanelProps> = ({ builder, field, tab, readOnly }) => {
	const { draft } = builder;
	const location = findDraftField(draft.fields, field.id);
	const siblings = location?.siblings ?? [];
	const keyError = !FORM_KEY_PATTERN.test(field.key)
		? 'Start with a letter or _, then letters, digits or _'
		: siblings.some((item) => item.id !== field.id && item.key === field.key)
			? 'Another field here already uses this key'
			: null;

	const replace = (next: FormDraftField) =>
		builder.update((current) => ({ ...current, fields: updateDraftField(current.fields, field.id, () => next) }));
	const patch = (changes: Partial<FormDraftInputField>) =>
		field.kind === 'input' && replace({ ...field, ...changes });

	const keyInput = (
		<TextInput
			size="xs"
			label="Key"
			description="The property name in the payload"
			ff="monospace"
			value={field.key}
			error={keyError}
			onChange={(event) => {
				const key = event.currentTarget.value;
				builder.update((current) => renameDraftField(current, field.id, key));
			}}
		/>
	);
	const requiredSwitch = (
		<Switch
			size="xs"
			label="Required"
			checked={field.required}
			onChange={(event) => replace({ ...field, required: event.currentTarget.checked })}
		/>
	);

	if (field.kind === 'raw') {
		return (
			<Fieldset variant="unstyled" p={0} disabled={readOnly}>
				<Stack gap="sm">
					{keyInput}
					{requiredSwitch}
					<Text fz="xs" c="dimmed">
						The builder can't edit this field ({field.reason}). It's saved exactly as written.
					</Text>
					<CodeEditor language="json" height={200} readOnly value={JSON.stringify(field.schema, null, 2)} />
					<Button
						size="xs"
						variant="default"
						leftSection={<LuBraces size={14} />}
						onClick={() => builder.setTab('json')}
					>
						Edit in JSON tab
					</Button>
				</Stack>
			</Fieldset>
		);
	}

	const topLevel = !location?.parent;
	const container = containerOf(draft, field.id);
	const sectionId = container?.type === 'section' ? container.id : '';
	const choice = CHOICE_WIDGETS.has(field.widget);
	const typed = choice || field.widget === 'remote-select';

	return (
		<Fieldset variant="unstyled" p={0} disabled={readOnly}>
			<Stack gap="sm">
				{tab === 'general' && (
					<>
						<Select
							size="xs"
							label="Widget"
							allowDeselect={false}
							data={Object.entries(FORM_WIDGET_LABELS)
								// A file field only goes top level.
								.filter(([value]) => topLevel || value !== 'file' || field.widget === 'file')
								.map(([value, label]) => ({ value, label }))}
							value={field.widget}
							onChange={(next) => next && replace(changeDraftWidget(field, next as FormWidget))}
						/>
						{keyInput}
						<TextInput
							size="xs"
							label="Label"
							placeholder={field.key}
							value={field.label}
							onChange={(event) => patch({ label: event.currentTarget.value })}
						/>
						<Textarea
							size="xs"
							label="Help text"
							autosize
							minRows={1}
							value={field.help}
							onChange={(event) => patch({ help: event.currentTarget.value })}
						/>
						{!NO_PLACEHOLDER.has(field.widget) && (
							<TextInput
								size="xs"
								label="Placeholder"
								value={field.placeholder}
								onChange={(event) => patch({ placeholder: event.currentTarget.value })}
							/>
						)}
					</>
				)}
				{tab === 'data' && (
					<>
						{field.widget === 'number' && (
							<Switch
								size="xs"
								label="Whole numbers only"
								checked={field.valueType === 'integer'}
								onChange={(event) =>
									patch({ valueType: event.currentTarget.checked ? 'integer' : 'number' })
								}
							/>
						)}
						{typed && (
							<Select
								size="xs"
								label="Value type"
								allowDeselect={false}
								data={[
									{ value: 'string', label: 'Text' },
									{ value: 'number', label: 'Number' },
									{ value: 'integer', label: 'Whole number' },
								]}
								value={field.valueType}
								onChange={(next) => {
									const valueType = next as FormDraftValueType;
									patch({
										valueType,
										enumValues: castOptions(field.enumValues.map(String), valueType),
										default: undefined,
									});
								}}
							/>
						)}
						{choice && (
							<TagsInput
								size="xs"
								label="Options"
								description="Press Enter after each option"
								value={field.enumValues.map(String)}
								onChange={(next) =>
									patch({ enumValues: castOptions(next, field.valueType), default: undefined })
								}
							/>
						)}

						{field.widget === 'file' && (
							<Switch
								size="xs"
								label="Multiple"
								description="Accept several files; the value is then a list"
								checked={!!field.multiple}
								onChange={(event) => {
									const { minItems: _min, maxItems: _max, ...rest } = field.constraints;
									patch({
										multiple: event.currentTarget.checked,
										// File counts only apply to a list.
										constraints: event.currentTarget.checked ? field.constraints : rest,
									});
								}}
							/>
						)}

						{field.widget === 'remote-select' && (
							<FormBuilderRemoteEditor field={field} disabled={readOnly} onChange={replace} />
						)}

						<DefaultInput field={field} onChange={(value) => patch({ default: value })} />
					</>
				)}
				{tab === 'validation' && (
					<>
						{requiredSwitch}
						<ConstraintInputs
							field={field}
							onChange={(changes) => patch({ constraints: { ...field.constraints, ...changes } })}
						/>
						{hasChildren(field) && (
							<Switch
								size="xs"
								label="Reject unknown keys"
								description={field.widget === 'repeater' ? 'In each item' : undefined}
								checked={field.strict}
								onChange={(event) => patch({ strict: event.currentTarget.checked })}
							/>
						)}
					</>
				)}
				{tab === 'style' && (
					<>
						{hasChildren(field) && (
							<Select
								size="xs"
								label="Style"
								allowDeselect={false}
								data={Object.entries(FORM_GROUP_STYLE_LABELS).map(([value, label]) => ({
									value,
									label,
								}))}
								value={field.groupStyle ?? 'default'}
								onChange={(next) => patch({ groupStyle: (next as FormGroupStyle) ?? undefined })}
							/>
						)}
						{draft.columns > 1 && (
							<Stack gap={4}>
								<Text fz="xs" fw={500}>
									Width
								</Text>
								<SegmentedControl
									size="xs"
									data={[
										...Array.from({ length: draft.columns - 1 }, (_, index) => String(index + 1)),
										{ value: 'full', label: 'Full' },
									]}
									value={
										field.colSpan && field.colSpan < draft.columns
											? String(field.colSpan)
											: field.colSpan === undefined &&
												  !['group', 'repeater', 'textarea'].includes(field.widget)
												? '1'
												: 'full'
									}
									onChange={(next) =>
										patch({ colSpan: next === 'full' ? draft.columns : Number(next) })
									}
								/>
							</Stack>
						)}
						{topLevel && draft.sections.length > 0 && (
							<Select
								size="xs"
								label="Section"
								allowDeselect={false}
								data={[
									{ value: '', label: 'Not in a section' },
									...draft.sections.map((section) => ({
										value: section.id,
										label: section.title || 'Untitled',
									})),
								]}
								value={sectionId}
								onChange={(next) =>
									builder.update((current) => {
										const target = next
											? ({ type: 'section', id: next } as const)
											: ({ type: 'ungrouped' } as const);
										return moveDraftField(
											current,
											field.id,
											target,
											containerFields(current, target).length,
										);
									})
								}
							/>
						)}
					</>
				)}
				{tab === 'logic' && (
					<FormBuilderConditionEditor
						value={field.visibleWhen}
						targets={conditionTargets(draft, field.id)}
						disabled={readOnly}
						onChange={(visibleWhen) => patch({ visibleWhen })}
					/>
				)}
			</Stack>
		</Fieldset>
	);
};
