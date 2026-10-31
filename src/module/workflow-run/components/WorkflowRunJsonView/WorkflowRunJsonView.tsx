import React from 'react';

import { ActionIcon, CopyButton, ScrollArea, Stack, Text, Tooltip } from '@mantine/core';
import { LuCheck, LuCopy } from 'react-icons/lu';

import { formatJson } from '@module/workflow-run/utils';

import { WorkflowRunFileRefs } from '../WorkflowRunFileRefs';
import classes from './WorkflowRunJsonView.module.scss';

interface WorkflowRunJsonViewProps {
	value: unknown;
	maxHeight?: number | string;
	emptyLabel?: string;
	/** Render a recorded `null` as JSON instead of the empty label, e.g. the output of a node that finished. */
	showNull?: boolean;
}

export const WorkflowRunJsonView: React.FC<WorkflowRunJsonViewProps> = ({
	value,
	maxHeight = 240,
	emptyLabel = 'No data captured',
	showNull,
}) => {
	const text = formatJson(value);

	if (!text || (text === 'null' && !(showNull && value === null))) {
		return (
			<Text fz="xs" c="dimmed" p="xs">
				{emptyLabel}
			</Text>
		);
	}

	return (
		<Stack gap={6}>
			<WorkflowRunFileRefs value={value} />
			<div className={classes.root}>
				<CopyButton value={text} timeout={1500}>
					{({ copied, copy }) => (
						<Tooltip label={copied ? 'Copied' : 'Copy JSON'}>
							<ActionIcon
								variant="default"
								size="sm"
								className={classes.copy}
								onClick={copy}
								aria-label="Copy JSON"
							>
								{copied ? <LuCheck size={12} /> : <LuCopy size={12} />}
							</ActionIcon>
						</Tooltip>
					)}
				</CopyButton>
				<ScrollArea.Autosize mah={maxHeight} type="auto">
					<pre className={classes.code}>{text}</pre>
				</ScrollArea.Autosize>
			</div>
		</Stack>
	);
};
