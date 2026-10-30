import React from 'react';

import { Alert, Chip, Fieldset, Group, Input, NumberInput, Stack, TagsInput, Text, TextInput } from '@mantine/core';
import { LuTriangleAlert } from 'react-icons/lu';

import { Permission, useCan } from '@core/auth/authorization';

import { useGetFormQuery } from '@module/form-engine/hooks';
import { useWorkflowDefinitionEditorNodeActions } from '@module/workflow-definition/hooks';
import type { WorkflowDefinitionEditorNode } from '@module/workflow-definition/types/WorkflowDefinitionEditorNode';
import type { WorkflowDefinitionInputAccept } from '@module/workflow-definition/types/WorkflowDefinitionInputAccept';
import type { WorkflowDefinitionInputStorage } from '@module/workflow-definition/types/WorkflowDefinitionInputStorage';

import { SectionLabel } from './InspectorControls';
import { JSON_TYPE, MULTIPART_TYPE, withMultipart } from './InspectorInputAccept.utils';

const BYTES_PER_MB = 1024 * 1024;

const wrapperOrder: ('label' | 'input' | 'description' | 'error')[] = ['label', 'input', 'description', 'error'];

interface InspectorInputAcceptProps {
	node: WorkflowDefinitionEditorNode;
	label: string;
	description?: string;
	errors: Record<string, string>;
	readOnly?: boolean;
}

/** The input node's accepted bodies, and the upload target while multipart is one of them. */
export const InspectorInputAccept: React.FC<InspectorInputAcceptProps> = ({
	node,
	label,
	description,
	errors,
	readOnly,
}) => {
	const { patch } = useWorkflowDefinitionEditorNodeActions(node.id);
	const { config } = node;
	const accept = config.accept?.length ? config.accept : [JSON_TYPE];
	const multipart = accept.includes(MULTIPART_TYPE);
	const storage = config.storage ?? undefined;

	const canRead = useCan(Permission.FormsRead);
	const form = useGetFormQuery(config.form_id ?? '', { skip: !canRead || !config.form_id });
	const formMultipart = form.data?.content_type === MULTIPART_TYPE;
	const formMismatch = !form.data
		? null
		: formMultipart && !multipart
			? `The form "${form.data.name}" sends multipart, which this node doesn't accept.`
			: !formMultipart && !accept.includes(JSON_TYPE)
				? `The form "${form.data.name}" sends JSON, but this node only accepts multipart.`
				: null;

	const setStorage = (changes: Partial<WorkflowDefinitionInputStorage>) =>
		patch({ storage: { bucket: '', ...storage, ...changes } });

	return (
		<Stack gap="sm">
			<Input.Wrapper
				label={<SectionLabel>{label}</SectionLabel>}
				description={description}
				error={errors.accept}
				inputWrapperOrder={wrapperOrder}
			>
				<Chip.Group
					multiple
					value={accept}
					onChange={(next) => {
						if (readOnly || next.length === 0) return;
						const types = next as WorkflowDefinitionInputAccept[];
						const on = types.includes(MULTIPART_TYPE);
						patch({
							...withMultipart(types, on),
							...(on && !storage ? { storage: { bucket: '' } } : {}),
						});
					}}
				>
					<Group gap="xs" mt={6}>
						<Chip size="xs" value={JSON_TYPE} disabled={readOnly}>
							JSON
						</Chip>
						<Chip size="xs" value={MULTIPART_TYPE} disabled={readOnly}>
							Multipart (files)
						</Chip>
					</Group>
				</Chip.Group>
			</Input.Wrapper>

			{formMismatch && (
				<Alert color="yellow" variant="light" icon={<LuTriangleAlert size={16} />} p="xs">
					<Text fz="xs">{formMismatch}</Text>
				</Alert>
			)}

			{multipart && (
				<Fieldset
					legend={<SectionLabel>File storage</SectionLabel>}
					disabled={readOnly}
					variant="filled"
					p="sm"
				>
					<Stack gap="xs">
						<Text fz="xs" c="dimmed">
							Uploaded files go to this bucket. The endpoint and credentials are the engine's own.
						</Text>
						<TextInput
							size="xs"
							label="Bucket"
							withAsterisk
							placeholder="uploads"
							value={storage?.bucket ?? ''}
							error={errors['storage.bucket'] ?? errors.storage}
							onChange={(event) => setStorage({ bucket: event.currentTarget.value.trim() })}
						/>
						<TextInput
							size="xs"
							label="Key prefix"
							placeholder="orders/"
							description="Put before every object key"
							value={storage?.prefix ?? ''}
							error={errors['storage.prefix']}
							onChange={(event) => setStorage({ prefix: event.currentTarget.value || undefined })}
						/>
						<TagsInput
							size="xs"
							label="Allowed types"
							description="MIME types like application/pdf or image/*; none allows any"
							placeholder="image/*"
							value={storage?.allowed_mime_types ?? []}
							error={errors['storage.allowed_mime_types']}
							onChange={(next) => setStorage({ allowed_mime_types: next.length ? next : undefined })}
						/>
						<NumberInput
							size="xs"
							label="Max size per file"
							description="Leave empty for the engine limit"
							suffix=" MB"
							min={0}
							decimalScale={2}
							value={
								storage?.max_file_bytes === undefined
									? ''
									: Number((storage.max_file_bytes / BYTES_PER_MB).toFixed(2))
							}
							error={errors['storage.max_file_bytes']}
							onChange={(next) =>
								setStorage({
									max_file_bytes:
										typeof next === 'number' && next > 0
											? Math.round(next * BYTES_PER_MB)
											: undefined,
								})
							}
						/>
					</Stack>
				</Fieldset>
			)}
		</Stack>
	);
};
