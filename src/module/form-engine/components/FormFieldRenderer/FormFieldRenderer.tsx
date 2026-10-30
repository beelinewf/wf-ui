import React from 'react';

import {
	ActionIcon,
	Button,
	Card,
	Checkbox,
	Fieldset,
	Grid,
	Group,
	MultiSelect,
	NumberInput,
	Radio,
	Select,
	Stack,
	Switch,
	TagsInput,
	Text,
	Textarea,
	TextInput,
	Tooltip,
} from '@mantine/core';
import { DateInput, DateTimePicker } from '@mantine/dates';
import { LuArrowDown, LuArrowUp, LuPlus, LuTrash2 } from 'react-icons/lu';

import type { JsonSchema } from '@common/types/JsonSchema';

import type { FormEngine } from '@module/form-engine/types/FormEngine';
import type { FormFieldModel } from '@module/form-engine/types/FormFieldModel';
import type { FormGroupStyle } from '@module/form-engine/types/FormGroupStyle';
import { initialObjectValue, isFieldVisible, joinValuePath } from '@module/form-engine/utils';

import { FormFileField } from './FormFileField';
import { FormJsonField } from './FormJsonField';
import { FormRemoteSelectField } from './FormRemoteSelectField';
import { FormTimeField } from './FormTimeField';

/** Columns collapse by the form's own width, so a form in a narrow modal stacks even on a wide screen. */
const GRID_BREAKPOINTS = { xs: '320px', sm: '480px', md: '720px', lg: '960px', xl: '1200px' };

interface FieldProps {
	engine: FormEngine;
	field: FormFieldModel;
	/** Concrete value path, e.g. `items.0.sku`. */
	path: string;
	disabled?: boolean;
}

/** Enum values as Mantine options, keyed by their string form so numbers and booleans round-trip. */
const enumOptions = (values: unknown[] = []) => {
	const byKey = new Map(values.map((value) => [String(value), value]));
	return {
		data: [...byKey.keys()].map((key) => ({ value: key, label: key })),
		toValue: (key: string | null) => (key === null ? null : byKey.get(key)),
		toKey: (value: unknown) => (value === null || value === undefined ? null : String(value)),
	};
};

const FormArrayField: React.FC<FieldProps> = ({ engine, field, path, disabled }) => {
	const { form } = engine;
	const stored = getAt(form.getValues(), path);
	const items = Array.isArray(stored) ? stored : [];
	const max = field.schema.maxItems;
	const error = form.errors[path];

	return (
		<FormStructureFrame
			style={field.groupStyle}
			title={
				<>
					{field.label}
					{field.required && (
						<Text span c="red">
							{' '}
							*
						</Text>
					)}
				</>
			}
		>
			<Stack gap="sm">
				{field.help && (
					<Text fz="xs" c="dimmed">
						{field.help}
					</Text>
				)}
				{items.map((_, index) => {
					const itemPath = joinValuePath(path, index);
					return (
						<Card key={index} withBorder padding="sm">
							<Group justify="space-between" mb="xs" gap="xs">
								<Text fz="xs" fw={600} c="dimmed">
									{field.label} #{index + 1}
								</Text>
								{!disabled && (
									<Group gap={2}>
										<Tooltip label="Move up">
											<ActionIcon
												variant="subtle"
												color="gray"
												size="sm"
												disabled={index === 0}
												aria-label="Move item up"
												onClick={() =>
													form.reorderListItem(path, { from: index, to: index - 1 })
												}
											>
												<LuArrowUp size={14} />
											</ActionIcon>
										</Tooltip>
										<Tooltip label="Move down">
											<ActionIcon
												variant="subtle"
												color="gray"
												size="sm"
												disabled={index === items.length - 1}
												aria-label="Move item down"
												onClick={() =>
													form.reorderListItem(path, { from: index, to: index + 1 })
												}
											>
												<LuArrowDown size={14} />
											</ActionIcon>
										</Tooltip>
										<Tooltip label="Remove">
											<ActionIcon
												variant="subtle"
												color="red"
												size="sm"
												aria-label="Remove item"
												onClick={() => form.removeListItem(path, index)}
											>
												<LuTrash2 size={14} />
											</ActionIcon>
										</Tooltip>
									</Group>
								)}
							</Group>
							<FormFieldGrid
								engine={engine}
								fields={field.children}
								prefix={itemPath}
								disabled={disabled}
							/>
						</Card>
					);
				})}
				{items.length === 0 && (
					<Text fz="xs" c="dimmed">
						No items
					</Text>
				)}
				{error && (
					<Text fz="xs" c="red">
						{error}
					</Text>
				)}
				{!disabled && (
					<Group>
						<Button
							size="xs"
							variant="default"
							leftSection={<LuPlus size={14} />}
							disabled={max !== undefined && items.length >= max}
							onClick={() => form.insertListItem(path, initialObjectValue(field.children, {}))}
						>
							Add item
						</Button>
					</Group>
				)}
			</Stack>
		</FormStructureFrame>
	);
};

/** The frame around a group's or repeater's fields, in the style the field picked. */
const FormStructureFrame: React.FC<{ style?: FormGroupStyle; title: React.ReactNode; children: React.ReactNode }> = ({
	style = 'default',
	title,
	children,
}) => {
	if (style === 'card') {
		return (
			<Card withBorder shadow="xs" radius="md" padding="md">
				<Text fz="sm" fw={600} mb="xs">
					{title}
				</Text>
				{children}
			</Card>
		);
	}

	return (
		<Fieldset
			legend={
				<Text span fz="sm" fw={600}>
					{title}
				</Text>
			}
			variant={style === 'dotted' ? 'default' : style}
			styles={
				style === 'dotted' ? { root: { border: '2px dotted var(--mantine-color-default-border)' } } : undefined
			}
		>
			{children}
		</Fieldset>
	);
};

const FormGroupField: React.FC<FieldProps> = ({ engine, field, path, disabled }) => (
	<FormStructureFrame style={field.groupStyle} title={field.label}>
		<Stack gap="sm">
			{field.help && (
				<Text fz="xs" c="dimmed">
					{field.help}
				</Text>
			)}
			<FormFieldGrid engine={engine} fields={field.children} prefix={path} disabled={disabled} />
		</Stack>
	</FormStructureFrame>
);

const getAt = (values: unknown, path: string): unknown =>
	path.split('.').reduce<unknown>((current, segment) => {
		if (current === null || typeof current !== 'object') return undefined;
		return (current as Record<string, unknown>)[segment];
	}, values);

/** One field, by widget. Groups and repeaters render their children through `FormFieldGrid`. */
export const FormFieldRenderer: React.FC<FieldProps> = ({ engine, field, path, disabled }) => {
	const { form } = engine;
	const value = getAt(form.getValues(), path);
	const error = form.errors[path];
	const common = {
		label: field.label,
		description: field.help,
		withAsterisk: field.required,
		error,
		disabled,
		placeholder: field.placeholder,
		inputWrapperOrder: ['label', 'input', 'description', 'error'] as (
			| 'label'
			| 'input'
			| 'description'
			| 'error'
		)[],
	};
	const set = (next: unknown) => form.setFieldValue(path, next);
	const schema = field.schema;
	const items = schema.items as JsonSchema | undefined;

	switch (field.widget) {
		case 'group':
			return <FormGroupField engine={engine} field={field} path={path} disabled={disabled} />;
		case 'repeater':
			return <FormArrayField engine={engine} field={field} path={path} disabled={disabled} />;
		case 'textarea':
			return <Textarea {...common} autosize minRows={3} maxRows={12} {...form.getInputProps(path)} />;
		case 'number':
			return (
				<NumberInput
					{...common}
					allowDecimal={schema.type !== 'integer'}
					min={schema.minimum}
					max={schema.maximum}
					{...form.getInputProps(path)}
				/>
			);
		case 'switch':
			return (
				<Switch
					label={field.label}
					description={field.help}
					error={error}
					disabled={disabled}
					{...form.getInputProps(path, { type: 'checkbox' })}
				/>
			);
		case 'checkbox':
			return (
				<Checkbox
					label={field.label}
					description={field.help}
					error={error}
					disabled={disabled}
					{...form.getInputProps(path, { type: 'checkbox' })}
				/>
			);
		case 'select': {
			const options = enumOptions(schema.enum);
			return (
				<Select
					{...common}
					data={options.data}
					clearable={!field.required}
					searchable={options.data.length > 8}
					value={options.toKey(value)}
					onChange={(key) => set(options.toValue(key))}
				/>
			);
		}
		case 'radio': {
			const options = enumOptions(schema.enum);
			return (
				<Radio.Group {...common} value={options.toKey(value)} onChange={(key) => set(options.toValue(key))}>
					<Group gap="md" mt={6}>
						{options.data.map((option) => (
							<Radio key={option.value} value={option.value} label={option.label} disabled={disabled} />
						))}
					</Group>
				</Radio.Group>
			);
		}
		case 'multiselect': {
			const options = enumOptions(items?.enum);
			return (
				<MultiSelect
					{...common}
					data={options.data}
					clearable
					searchable={options.data.length > 8}
					value={(Array.isArray(value) ? value : []).map((item) => String(item))}
					onChange={(keys) => set(keys.map((key) => options.toValue(key)))}
				/>
			);
		}
		case 'checkbox-group': {
			const options = enumOptions(items?.enum);
			return (
				<Checkbox.Group
					{...common}
					value={(Array.isArray(value) ? value : []).map((item) => String(item))}
					onChange={(keys) => set(keys.map((key) => options.toValue(key)))}
				>
					<Group gap="md" mt={6}>
						{options.data.map((option) => (
							<Checkbox
								key={option.value}
								value={option.value}
								label={option.label}
								disabled={disabled}
							/>
						))}
					</Group>
				</Checkbox.Group>
			);
		}
		case 'date':
			return (
				<DateInput
					{...common}
					valueFormat="YYYY-MM-DD"
					clearable={!field.required}
					value={typeof value === 'string' && value ? value : null}
					onChange={(next) => set(next ?? '')}
				/>
			);
		case 'datetime':
			return (
				<DateTimePicker
					{...common}
					valueFormat="YYYY-MM-DD HH:mm"
					clearable={!field.required}
					value={typeof value === 'string' && value ? value : null}
					onChange={(next) => set(next ?? '')}
				/>
			);
		case 'time':
			return <FormTimeField {...common} clearable={!field.required} value={value} onChange={set} />;
		case 'remote-select':
			if (field.options?.url) {
				return (
					<FormRemoteSelectField
						engine={engine}
						field={field}
						options={field.options}
						path={path}
						value={value}
						error={error}
						disabled={disabled}
						onChange={set}
					/>
				);
			}
			// Without a configured request there's nothing to load, so the value is typed in.
			return Array.isArray(value) || schema.type === 'array' ? (
				<TagsInput
					{...common}
					value={(Array.isArray(value) ? value : []).map(String)}
					onChange={(next) => set(next)}
				/>
			) : (
				<TextInput
					{...common}
					value={value === null || value === undefined ? '' : String(value)}
					onChange={(event) => set(event.currentTarget.value || null)}
				/>
			);
		case 'file':
			return (
				<FormFileField
					field={field}
					value={value}
					errors={Object.entries(form.errors)
						.filter(([at]) => at === path || at.startsWith(`${path}.`))
						.map(([, message]) => String(message))}
					disabled={disabled}
					onChange={set}
				/>
			);
		case 'json':
			return (
				<FormJsonField
					label={field.label}
					description={field.help}
					required={field.required}
					error={error}
					value={value}
					disabled={disabled}
					onChange={set}
				/>
			);
		default:
			return <TextInput {...common} {...form.getInputProps(path)} />;
	}
};

interface FormFieldGridProps {
	engine: FormEngine;
	fields: FormFieldModel[];
	/** Value path of the object these fields belong to; empty at the top level. */
	prefix: string;
	disabled?: boolean;
}

/** `fields` laid out on the form's column grid, hidden ones left out. */
export const FormFieldGrid: React.FC<FormFieldGridProps> = ({ engine, fields, prefix, disabled }) => {
	const columns = engine.model.columns;
	const values = engine.form.getValues();
	const visible = fields.filter((field) => isFieldVisible(field, values, joinValuePath(prefix, field.key)));
	if (visible.length === 0) return null;

	return (
		<Grid columns={columns} gap="sm" type="container" breakpoints={GRID_BREAKPOINTS}>
			{visible.map((field) => (
				<Grid.Col key={field.key} span={{ base: columns, sm: Math.min(field.colSpan ?? columns, columns) }}>
					<FormFieldRenderer
						engine={engine}
						field={field}
						path={joinValuePath(prefix, field.key)}
						disabled={disabled}
					/>
				</Grid.Col>
			))}
		</Grid>
	);
};
