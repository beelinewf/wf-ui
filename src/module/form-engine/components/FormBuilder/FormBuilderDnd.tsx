import React, { useState } from 'react';
import { createPortal } from 'react-dom';

import {
	type CollisionDetection,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	pointerWithin,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Text } from '@mantine/core';

import { FORM_WIDGET_LABELS } from '@module/form-engine/constant';
import type { FormBuilderState } from '@module/form-engine/types/FormBuilderState';
import type { FormWidget } from '@module/form-engine/types/FormWidget';
import {
	type FormBuilderContainer,
	containerFields,
	findDraftField,
	hasChildren,
	moveDraftField,
	parseContainerId,
	walkDraft,
} from '@module/form-engine/utils';

import { FORM_WIDGET_META } from './FormBuilder.constants';
import classes from './FormBuilder.module.scss';
import { FormBuilderDndContext } from './FormBuilderDnd.context';

// Above drawers and modals, so a drag from the quick-create drawer stays visible.
const OVERLAY_Z_INDEX = 1000;

interface FormBuilderDndProps {
	builder: FormBuilderState;
	children: React.ReactNode;
}

/**
 * One drag context for the palette and the field tree, so fields can be dragged in from the palette as well as
 * reordered. React context crosses the layout panels' portals, so the palette may render in another panel.
 */
export const FormBuilderDnd: React.FC<FormBuilderDndProps> = ({ builder, children }) => {
	const [overId, setOverId] = useState<string | null>(null);
	const [dragging, setDragging] = useState<FormWidget | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);
	const { draft } = builder;

	// The innermost target under the pointer wins, and a field can't land inside itself.
	const collision: CollisionDetection = (args) => {
		const activeId = String(args.active.id);
		const self = findDraftField(draft.fields, activeId);
		const own = new Set(
			self && hasChildren(self.field) ? walkDraft(self.field.children).map((item) => item.field.id) : [],
		);
		// A file field only goes top level, so groups and repeaters and the fields inside them aren't targets.
		const topLevelOnly = dragging === 'file' || (self?.field.kind === 'input' && self.field.widget === 'file');
		const allowed = args.droppableContainers.filter((droppable) => {
			const id = String(droppable.id);
			if (id === activeId || own.has(id)) return false;
			const container = parseContainerId(id);
			if (topLevelOnly) {
				const target = container ?? (droppable.data.current?.container as FormBuilderContainer | undefined);
				if (target?.type === 'children') return false;
			}
			return !(container?.type === 'children' && (container.id === activeId || own.has(container.id)));
		});
		const within = pointerWithin({ ...args, droppableContainers: allowed });
		// A palette drag only lands where the pointer is; an existing field snaps to the nearest spot.
		if (!within.length) return dragging ? [] : closestCenter({ ...args, droppableContainers: allowed });
		const area = (id: string | number) => {
			const rect = args.droppableRects.get(id);
			return rect ? rect.width * rect.height : Infinity;
		};
		return [...within].sort((a, b) => area(a.id) - area(b.id)).slice(0, 1);
	};

	const reset = () => {
		setOverId(null);
		setDragging(null);
	};

	const onDragStart = ({ active }: DragStartEvent) =>
		setDragging((active.data.current?.widget as FormWidget | undefined) ?? null);

	const onDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		const widget = active.data.current?.widget as FormWidget | undefined;
		reset();
		if (!over || active.id === over.id) return;
		const overKey = String(over.id);
		const asContainer = parseContainerId(overKey);
		const container = asContainer ?? (over.data.current?.container as FormBuilderContainer | undefined);
		if (!container) return;
		if (widget === 'file' && container.type === 'children') return;
		const list = containerFields(draft, container);
		// Onto a container: at its end. Onto a field: in its place, pushing it down.
		const index = Math.max(0, asContainer ? list.length : list.findIndex((field) => field.id === overKey));
		if (widget) builder.addAt(widget, container, index);
		else builder.update((current) => moveDraftField(current, String(active.id), container, index));
	};

	const meta = dragging ? FORM_WIDGET_META[dragging] : null;

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={collision}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDragEnd={onDragEnd}
			onDragCancel={reset}
		>
			<FormBuilderDndContext.Provider value={overId}>{children}</FormBuilderDndContext.Provider>
			{createPortal(
				<DragOverlay zIndex={OVERLAY_Z_INDEX} dropAnimation={null}>
					{dragging && meta && (
						<div className={classes.paletteItem} data-overlay>
							<div className={classes.paletteIcon}>
								<meta.icon size={18} color={`var(--mantine-color-${meta.color}-6)`} />
							</div>
							<div className={classes.paletteBody}>
								<Text fz="sm" fw={600} truncate>
									{FORM_WIDGET_LABELS[dragging]}
								</Text>
								<Text fz="xs" c="dimmed" truncate>
									{meta.description}
								</Text>
							</div>
						</div>
					)}
				</DragOverlay>,
				document.body,
			)}
		</DndContext>
	);
};
