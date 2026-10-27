import React from 'react';

import { ActionIcon, CloseButton, Text, TextInput, Title } from '@mantine/core';
import { LuSearch } from 'react-icons/lu';

import { WingPattern } from '@common/component/WingPattern';

import classes from './WorkflowDefinitionHero.module.scss';

interface WorkflowDefinitionHeroProps {
	/** Exact, case-sensitive name: the engine has no partial-match search. */
	name: string;
	onNameChange: (value: string) => void;
}

export const WorkflowDefinitionHero: React.FC<WorkflowDefinitionHeroProps> = ({ name, onNameChange }) => {
	return (
		<div className={classes.root}>
			<WingPattern className={classes.pattern} scale={0.7} />

			<div className={classes.content}>
				<Title order={3} className={classes.title}>
					Build Automations Faster with
					<br />
					<span className={classes.highlight}>Versioned</span> Workflow Definitions
				</Title>
				<Text fz="sm" ta="center" className={classes.description}>
					Immutable definitions — every change ships as a new version.
				</Text>

				<TextInput
					className={classes.search}
					radius="xl"
					size="md"
					placeholder="Find a workflow definition by its exact name..."
					aria-label="Filter workflow definitions by exact name"
					value={name}
					onChange={(event) => onNameChange(event.currentTarget.value)}
					rightSectionWidth={name ? 68 : 44}
					rightSection={
						<>
							{name && <CloseButton size="sm" aria-label="Clear name" onClick={() => onNameChange('')} />}
							<ActionIcon variant="filled" color="brand" radius="xl" size={30} aria-label="Search">
								<LuSearch size={15} />
							</ActionIcon>
						</>
					}
				/>
			</div>
		</div>
	);
};
