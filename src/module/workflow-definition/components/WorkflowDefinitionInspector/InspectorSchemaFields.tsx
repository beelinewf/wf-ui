import React from 'react';

import { Autocomplete, TagsInput } from '@mantine/core';

import { useCoreSelector } from '@core/store';

import { CodeEditor } from '@common/component/CodeEditor';

import { FormPicker } from '@module/form-engine/components/FormPicker';
import {
	SchemaForm,
	type SchemaFieldContext,
	type SchemaFieldOverride,
} from '@module/form-engine/components/SchemaForm';
import { nodeTypeSchema, selectNodeTypeCatalog } from '@module/node-type/utils';
import { useListRolesQuery } from '@module/role/hooks';
import { UserPicker } from '@module/user/components/UserPicker';
import { useWorkflowDefinitionEditorNodeActions } from '@module/workflow-definition/hooks';
import { selectEditorIssues } from '@module/workflow-definition/store';
import type { WorkflowDefinitionEditorNode } from '@module/workflow-definition/types/WorkflowDefinitionEditorNode';
import type { WorkflowDefinitionNodeConfig } from '@module/workflow-definition/types/WorkflowDefinitionNodeConfig';
import { isContextPath } from '@module/workflow-definition/utils';

import { useContextTypes } from './InspectorContextTypes.context';
import { ContextInput, DurationInput, HeadersField, JsonField, SectionLabel } from './InspectorControls';
import { branchDeclaration, usePartner } from './InspectorStructuralFields.utils';

/** Wording and widgets the schema can't say, by field path. Everything else comes from the schema as served. */
const FIELD_OVERRIDES: Record<string, SchemaFieldOverride> = {
	form_id: {
		kind: 'string',
		label: 'Form',
		description:
			'Shown to whoever delivers this input, instead of a raw JSON box. The payload is checked against it.',
	},
	pre_script: {
		label: 'Pre-script',
		description: 'Transforms context before the node runs. Return value is ignored.',
	},
	post_script: {
		label: 'Post-script',
		description: 'Runs after the output is merged. The native output is available as `output`.',
	},
	timeout: { description: 'Defaults to the engine timeout, capped by the engine maximum', placeholder: '30s' },
	delay: {
		description:
			"How long to wait before continuing, capped by the engine maximum (default 5m). Repeats on every visit and doesn't hold a worker.",
		placeholder: '30s',
	},
	http_config: { label: 'HTTP request' },
	execution_config: { label: 'Command' },
	'http_config.body': { description: 'JSON. String values support {{ path }} templates.' },
	'execution_config.stdin': { kind: 'template', description: 'Supports {{ path }} templates' },
	'redis.key': { kind: 'template', placeholder: 'job:{{ job.id }}:status' },
	'redis.channel': { kind: 'template', placeholder: 'events:{{ workflow_instance_id }}' },
};

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
const METHOD_PATHS = new Set(['http_config.method', 'http.method']);

const wrapperOrder: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error'];

interface InspectorSchemaFieldsProps {
	node: WorkflowDefinitionEditorNode;
	keys: string[];
}

/** Generated fields for `keys` of the node's catalog schema, with the editor's own widgets where they fit. */
export const InspectorSchemaFields: React.FC<InspectorSchemaFieldsProps> = ({ node, keys }) => {
	const { patch } = useWorkflowDefinitionEditorNodeActions(node.id);
	const catalog = useCoreSelector(selectNodeTypeCatalog);
	const issues = useCoreSelector(selectEditorIssues);
	const contextTypes = useContextTypes();
	const partner = usePartner(node);
	const roles = useListRolesQuery(undefined, { skip: !keys.includes('allowed_roles') });

	const schema = nodeTypeSchema(catalog, node.config.type);
	if (!schema || keys.length === 0) return null;

	const errors = Object.fromEntries(
		issues.filter((issue) => issue.nodeId === node.id && issue.path).map((issue) => [issue.path!, issue.message]),
	);
	// The join's script reads the paired parallel's branches by name.
	const branchNames = (partner?.branches ?? []).map((branch) => branch.key.trim()).filter(Boolean);

	const renderField = (field: SchemaFieldContext): React.ReactNode | undefined => {
		const { path, kind, label, description, placeholder, required, value, onChange, error } = field;
		const text = typeof value === 'string' ? value : '';
		const labelNode = <SectionLabel required={required}>{label}</SectionLabel>;

		if (METHOD_PATHS.has(path)) {
			return (
				<Autocomplete
					label={labelNode}
					description={description}
					inputWrapperOrder={wrapperOrder}
					placeholder="GET"
					data={HTTP_METHODS}
					value={text}
					onChange={(next) => onChange(next || undefined)}
					error={error}
				/>
			);
		}
		if (path === 'form_id') {
			return (
				<FormPicker
					label={labelNode}
					description={description}
					value={text || undefined}
					onChange={onChange}
					error={error}
					readOnly={field.readOnly}
				/>
			);
		}
		if (path === 'allowed_roles') {
			return (
				<TagsInput
					label={labelNode}
					description={description}
					inputWrapperOrder={wrapperOrder}
					placeholder="Any caller"
					data={(roles.data?.items ?? []).map((role) => role.name)}
					value={Array.isArray(value) ? value.map(String) : []}
					onChange={(next) => onChange(next.length > 0 ? next : undefined)}
					acceptValueOnBlur
					splitChars={[]}
					error={error}
				/>
			);
		}

		if (path === 'allowed_users') {
			const users = Array.isArray(value) ? (value as { id?: unknown }[]) : [];
			return (
				<UserPicker
					label={labelNode}
					description={description}
					placeholder="No user restriction"
					value={users.map((user) => String(user?.id ?? '')).filter(Boolean)}
					onChange={(ids) => onChange(ids.length > 0 ? ids.map((id) => ({ id })) : undefined)}
					error={error}
					readOnly={field.readOnly}
				/>
			);
		}

		switch (kind) {
			case 'script':
				return (
					<CodeEditor
						label={labelNode}
						description={description}
						height={path === 'script' || path === 'combining_script' ? 200 : 110}
						placeholder={placeholder}
						// The validation script gets the raw payload as `input`, not the context.
						extraLib={
							path === 'combining_script'
								? branchDeclaration(contextTypes, branchNames)
								: path === 'validation.script'
									? undefined
									: contextTypes
						}
						value={text}
						onChange={(next) => onChange(next)}
						error={error}
					/>
				);
			case 'duration':
				return (
					<DurationInput
						label={labelNode}
						description={description}
						inputWrapperOrder={wrapperOrder}
						placeholder={placeholder ?? 'Engine default'}
						value={typeof value === 'string' ? value : undefined}
						onChange={(next) => onChange(next ?? (required ? '' : undefined))}
						error={error}
					/>
				);
			case 'template':
				return (
					<ContextInput
						template
						label={labelNode}
						description={description}
						inputWrapperOrder={wrapperOrder}
						placeholder={placeholder ?? 'Value or {{ path }}'}
						value={text}
						onChange={(next) => onChange(next || (required ? '' : undefined))}
						error={error}
					/>
				);
			case 'contextPath':
				return (
					<ContextInput
						label={labelNode}
						description={description}
						inputWrapperOrder={wrapperOrder}
						placeholder={placeholder ?? 'order.items'}
						value={text}
						onChange={(next) => onChange(next || (required ? '' : undefined))}
						error={
							error ??
							(text && !isContextPath(text) ? 'Use a path like user.name or items[0]' : undefined)
						}
					/>
				);
			case 'json':
				return (
					<JsonField
						node={node}
						field={path}
						label={labelNode}
						description={description}
						required={required}
					/>
				);
			case 'stringMap':
				return (
					<HeadersField
						label={label}
						description={description}
						value={value as Record<string, string> | undefined}
						onChange={onChange}
					/>
				);
			default:
				return undefined;
		}
	};

	return (
		<SchemaForm
			schema={schema}
			value={node.config as Record<string, unknown>}
			onChange={(changes) => patch(changes as Partial<WorkflowDefinitionNodeConfig>)}
			keys={keys}
			errors={errors}
			override={(path) => FIELD_OVERRIDES[path]}
			renderField={renderField}
		/>
	);
};
