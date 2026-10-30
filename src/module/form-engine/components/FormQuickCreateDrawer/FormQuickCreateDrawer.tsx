import React, { useState } from 'react';

import { Alert, Button, Drawer, Group, Stack, Text, Tooltip } from '@mantine/core';
import { LuCircleAlert, LuSave } from 'react-icons/lu';

import { FormBuilder } from '@module/form-engine/components/FormBuilder';
import { useCreateFormMutation, useFormBuilder } from '@module/form-engine/hooks';
import type { Form } from '@module/form-engine/types/Form';
import { emptyDraft, formErrorMessage } from '@module/form-engine/utils';

interface QuickCreateBodyProps {
	onCancel: () => void;
	onCreated: (form: Form) => void;
}

const QuickCreateBody: React.FC<QuickCreateBodyProps> = ({ onCancel, onCreated }) => {
	const builder = useFormBuilder(emptyDraft());
	const [createForm, createState] = useCreateFormMutation();
	const [error, setError] = useState<string | null>(null);

	const save = async () => {
		setError(null);
		if (builder.issues.length) return;
		try {
			const created = await createForm({
				name: builder.draft.name.trim(),
				content_type: builder.draft.contentType,
				...builder.output,
			}).unwrap();
			onCreated(created);
		} catch (err) {
			setError(formErrorMessage(err, 'Failed to create the form'));
		}
	};

	return (
		<Stack gap="sm">
			<Group justify="space-between" gap="sm">
				<Text fz="sm" c="dimmed">
					Name the form in its settings on the right, then add fields.
				</Text>
				<Group gap="xs">
					<Button variant="default" onClick={onCancel} disabled={createState.isLoading}>
						Cancel
					</Button>
					<Tooltip
						label={`${builder.issues.length} ${builder.issues.length === 1 ? 'issue' : 'issues'} to fix`}
						disabled={builder.issues.length === 0}
					>
						<Button
							leftSection={<LuSave size={16} />}
							loading={createState.isLoading}
							disabled={builder.issues.length > 0}
							onClick={save}
						>
							Create and use
						</Button>
					</Tooltip>
				</Group>
			</Group>
			{error && (
				<Alert color="red" variant="light" icon={<LuCircleAlert size={16} />} p="xs">
					<Text fz="xs">{error}</Text>
				</Alert>
			)}
			<FormBuilder builder={builder} />
		</Stack>
	);
};

interface FormQuickCreateDrawerProps {
	opened: boolean;
	onClose: () => void;
	/** The new form, saved; the caller selects it. */
	onCreated: (form: Form) => void;
}

/** The builder in a drawer, so an input node can get a new form without leaving the definition editor. */
export const FormQuickCreateDrawer: React.FC<FormQuickCreateDrawerProps> = ({ opened, onClose, onCreated }) => (
	<Drawer opened={opened} onClose={onClose} position="right" size="100%" title="New form" keepMounted={false}>
		{opened && <QuickCreateBody onCancel={onClose} onCreated={onCreated} />}
	</Drawer>
);
