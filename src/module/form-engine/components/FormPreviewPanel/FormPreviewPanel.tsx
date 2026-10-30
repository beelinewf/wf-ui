import React, { useState } from 'react';

import { Badge, Card, Group, Stack, Text } from '@mantine/core';

import { CodeEditor } from '@common/component/CodeEditor';
import type { JsonSchema } from '@common/types/JsonSchema';

import { FormRenderer } from '@module/form-engine/components/FormRenderer';
import { useFormEngine } from '@module/form-engine/hooks';
import { describeFiles, validateFormPayload } from '@module/form-engine/utils';

import classes from './FormPreviewPanel.module.scss';

interface FormPreviewPanelProps {
	schema: JsonSchema;
	ui: unknown;
}

const PreviewBody: React.FC<FormPreviewPanelProps & { context: unknown }> = ({ schema, ui, context }) => {
	const engine = useFormEngine({ schema, ui, context });
	const { success, errors } = validateFormPayload(engine.model, engine.payload);
	const issues = Object.entries(errors);

	return (
		<div className={classes.layout}>
			<Card withBorder padding="md">
				<Stack gap="sm">
					<Text fz="xs" c="dimmed">
						Fill the form as an inputer would. Nothing is sent anywhere.
					</Text>
					<FormRenderer engine={engine} />
				</Stack>
			</Card>
			<Stack gap="sm">
				<Card withBorder padding="sm">
					<Stack gap={6}>
						<Text fz="xs" fw={600}>
							Payload
						</Text>
						<pre className={classes.json}>{JSON.stringify(describeFiles(engine.payload), null, 2)}</pre>
					</Stack>
				</Card>
				<Card withBorder padding="sm">
					<Stack gap={6}>
						<Group gap={6}>
							<Text fz="xs" fw={600}>
								Validation
							</Text>
							<Badge size="xs" variant="light" color={success ? 'teal' : 'red'}>
								{success ? 'passes' : `${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}`}
							</Badge>
						</Group>
						{issues.map(([path, message]) => (
							<Text key={path} fz="xs">
								<Text span ff="monospace" fz="xs" c="dimmed">
									{path || '(form)'}
								</Text>{' '}
								{message}
							</Text>
						))}
					</Stack>
				</Card>
			</Stack>
		</div>
	);
};

/** Test-fill: the real renderer, the payload it would deliver, and what zod says about it. */
export const FormPreviewPanel: React.FC<FormPreviewPanelProps> = ({ schema, ui }) => {
	const [contextText, setContextText] = useState('{}');
	const [context, setContext] = useState<unknown>({});
	const [contextError, setContextError] = useState<string | null>(null);

	return (
		<Stack gap="md">
			{/* A changed form restarts the preview, since form state is only seeded once. */}
			<PreviewBody key={JSON.stringify({ schema, ui })} schema={schema} ui={ui} context={context} />
			<CodeEditor
				label="Sample run context"
				description="What {{ context.* }} in remote selects reads while previewing"
				language="json"
				height={140}
				value={contextText}
				error={contextError}
				onChange={(text) => {
					setContextText(text);
					try {
						setContext(text.trim() ? JSON.parse(text) : {});
						setContextError(null);
					} catch {
						setContextError('Not valid JSON yet; the last valid context is used');
					}
				}}
			/>
		</Stack>
	);
};
