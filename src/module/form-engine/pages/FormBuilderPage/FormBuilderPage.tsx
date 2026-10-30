import React, { useRef, useState } from 'react';

import { Badge, Button, Center, Group, Loader, Modal, Stack, Text } from '@mantine/core';
import { LuCircleCheck } from 'react-icons/lu';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';

import { Permission, useCan } from '@core/auth/authorization';

import { useNavigateBack } from '@common/hooks/useNavigateBack';

import { MainLayoutPanel, MainLayoutPanelBar } from '@module/app/components/AppMainLayout';
import { useAppLayoutPanel, useAppLayoutPanels } from '@module/app/hooks';
import {
	FormBuilderCanvas,
	FormBuilderDnd,
	FormBuilderInspector,
	FormBuilderIssues,
	FormBuilderPalette,
} from '@module/form-engine/components/FormBuilder';
import { FormBuilderEditorHeader } from '@module/form-engine/components/FormBuilderEditorHeader';
import { FormUsageDrawer } from '@module/form-engine/components/FormUsageDrawer';
import {
	useCreateFormMutation,
	useFormBuilder,
	useGetFormQuery,
	useUpdateFormMutation,
} from '@module/form-engine/hooks';
import type { Form } from '@module/form-engine/types/Form';
import type { FormDraft } from '@module/form-engine/types/FormDraft';
import { draftFromForm, emptyDraft, formErrorMessage, formLibraryPath } from '@module/form-engine/utils';
import { useNotify } from '@module/notification/hooks';

import classes from './FormBuilderPage.module.scss';

interface FormBuilderEditorProps {
	/** The form being edited; absent for a new form or a duplicate. */
	form?: Form;
	initial: FormDraft;
	initialWarnings: string[];
	readOnly: boolean;
}

/** Laid out like the workflow definition editor: header on top, fields left, settings right, issues below. */
const FormBuilderEditor: React.FC<FormBuilderEditorProps> = ({ form, initial, initialWarnings, readOnly }) => {
	const builder = useFormBuilder(initial, initialWarnings);
	const navigate = useNavigate();
	const navigateBack = useNavigateBack(formLibraryPath());
	const notify = useNotify();
	const panel = useAppLayoutPanel();
	const [createForm, createState] = useCreateFormMutation();
	const [updateForm, updateState] = useUpdateFormMutation();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [usageOf, setUsageOf] = useState<Form | null>(null);
	const [discardOpened, setDiscardOpened] = useState(false);
	const allowLeave = useRef(false);

	useAppLayoutPanels({
		top: { opened: true },
		left: { opened: !readOnly },
		right: { opened: true },
		bottom: { opened: true, collapsed: true },
	});

	const blocker = useBlocker(
		({ currentLocation, nextLocation }) =>
			!allowLeave.current && builder.dirty && currentLocation.pathname !== nextLocation.pathname,
	);

	const save = async () => {
		setSaveError(null);
		if (builder.issues.length) {
			panel.setCollapsed('bottom', false);
			return;
		}
		const payload = { name: builder.draft.name.trim(), content_type: builder.draft.contentType, ...builder.output };

		try {
			if (form) {
				await updateForm({ id: form.id, ...payload }).unwrap();
				builder.markSaved();
				notify.success({ title: 'Form saved', message: `${payload.name} saved` });
			} else {
				const created = await createForm(payload).unwrap();
				builder.markSaved();
				notify.success({ title: 'Form created', message: `${payload.name} created` });
				allowLeave.current = true;
				navigate(formLibraryPath(created.id), { replace: true });
				allowLeave.current = false;
			}
		} catch (error) {
			setSaveError(formErrorMessage(error, 'Failed to save the form'));
		}
	};

	const building = builder.tab === 'build';
	const problems = builder.issues.length + builder.warnings.length;

	return (
		// One drag context around the panels and the canvas, so the palette can drop onto the tree.
		<FormBuilderDnd builder={builder}>
			<MainLayoutPanel side="top">
				<FormBuilderEditorHeader
					form={form}
					builder={builder}
					readOnly={readOnly}
					saving={createState.isLoading || updateState.isLoading}
					saveError={saveError}
					onSave={save}
					onBack={navigateBack}
					onDiscard={() => setDiscardOpened(true)}
					onOpenUsage={setUsageOf}
					onDuplicate={(source) => navigate(`${formLibraryPath()}/new?from=${encodeURIComponent(source.id)}`)}
					onDismissSaveError={() => setSaveError(null)}
				/>
			</MainLayoutPanel>
			{/* JSON and Preview take the whole canvas; the panels only belong to building. */}
			{building && !readOnly && (
				<MainLayoutPanel side="left" w={280} drawerBelow="md">
					<FormBuilderPalette target={builder.addTarget} onAdd={builder.add} />
				</MainLayoutPanel>
			)}
			{building && (
				<MainLayoutPanel side="right" w={360} drawerBelow="md">
					<FormBuilderInspector builder={builder} readOnly={readOnly} form={form} />
				</MainLayoutPanel>
			)}
			<MainLayoutPanel side="bottom">
				<MainLayoutPanelBar
					title="Issues"
					meta={
						problems > 0 ? (
							<Badge size="sm" color={builder.issues.length > 0 ? 'red' : 'yellow'} variant="light">
								{problems}
							</Badge>
						) : (
							<Text component="span" c="teal.6" display="inline-flex" aria-label="No issues">
								<LuCircleCheck size={14} />
							</Text>
						)
					}
				>
					<FormBuilderIssues builder={builder} />
				</MainLayoutPanelBar>
			</MainLayoutPanel>

			<div className={classes.root}>
				<FormBuilderCanvas builder={builder} readOnly={readOnly} />
			</div>

			<FormUsageDrawer form={usageOf} onClose={() => setUsageOf(null)} />

			<Modal opened={discardOpened} onClose={() => setDiscardOpened(false)} title="Discard changes?" centered>
				<Text fz="sm" c="dimmed">
					Everything you've changed since the last save will be undone.
				</Text>
				<Group justify="flex-end" mt="lg" gap="xs">
					<Button variant="default" onClick={() => setDiscardOpened(false)}>
						Keep editing
					</Button>
					<Button
						color="red"
						onClick={() => {
							builder.discard();
							setDiscardOpened(false);
						}}
					>
						Discard changes
					</Button>
				</Group>
			</Modal>

			<Modal
				opened={blocker.state === 'blocked'}
				onClose={() => blocker.reset?.()}
				title="Leave without saving?"
				centered
			>
				<Text fz="sm" c="dimmed">
					You have unsaved changes. If you leave this page, they'll be lost.
				</Text>
				<Group justify="flex-end" mt="lg" gap="xs">
					<Button variant="default" onClick={() => blocker.reset?.()}>
						Stay
					</Button>
					<Button color="red" onClick={() => blocker.proceed?.()}>
						Leave without saving
					</Button>
				</Group>
			</Modal>
		</FormBuilderDnd>
	);
};

/** Create (`/new`), duplicate (`/new?from=<id>`) or edit (`/:id`) a form. */
export const FormBuilderPage: React.FC = () => {
	const { id } = useParams();
	const [search] = useSearchParams();
	const from = id ? null : search.get('from');
	const sourceId = id ?? from;
	const canWrite = useCan(Permission.FormsWrite);
	const source = useGetFormQuery(sourceId ?? '', { skip: !sourceId });

	if (sourceId && !source.data) {
		if (source.isError) {
			return (
				<Center h="100%">
					<Stack align="center" gap="xs">
						<Text fw={600}>Couldn't load this form</Text>
						<Text fz="sm" c="dimmed">
							{formErrorMessage(source.error, 'It may have been deleted.')}
						</Text>
						<Button variant="default" size="xs" component={Link} to={formLibraryPath()}>
							Back to forms
						</Button>
					</Stack>
				</Center>
			);
		}
		return (
			<Center h="100%">
				<Loader size="sm" />
			</Center>
		);
	}

	const parsed = source.data
		? draftFromForm(
				from ? `Copy of ${source.data.name}` : source.data.name,
				source.data.schema,
				source.data.ui,
				source.data.content_type,
			)
		: { draft: emptyDraft(), warnings: [] };

	return (
		<FormBuilderEditor
			key={`${id ?? 'new'}:${from ?? ''}`}
			form={id ? source.data : undefined}
			initial={parsed.draft}
			initialWarnings={parsed.warnings}
			readOnly={!canWrite}
		/>
	);
};
