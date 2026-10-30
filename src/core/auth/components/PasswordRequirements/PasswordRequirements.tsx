import React from 'react';

import { Group, SimpleGrid, Text, VisuallyHidden } from '@mantine/core';
import { LuCheck, LuCircle } from 'react-icons/lu';

import { PASSWORD_REQUIREMENTS } from '@core/auth/dto';

interface PasswordRequirementsProps {
	password: string;
}

/** The engine's password rule as a live checklist, so it is visible while typing rather than only on submit. */
export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => (
	<SimpleGrid cols={2} spacing={4} verticalSpacing={2} aria-live="polite">
		{PASSWORD_REQUIREMENTS.map((requirement) => {
			const met = requirement.test(password);
			return (
				<Group key={requirement.id} gap={6} wrap="nowrap">
					{met ? (
						<LuCheck size={12} color="var(--mantine-color-teal-6)" aria-hidden />
					) : (
						<LuCircle size={10} color="var(--mantine-color-gray-5)" aria-hidden />
					)}
					<Text fz="xs" c={met ? 'teal.7' : 'dimmed'}>
						{requirement.label}
						<VisuallyHidden>{met ? ' (met)' : ' (not met)'}</VisuallyHidden>
					</Text>
				</Group>
			);
		})}
	</SimpleGrid>
);
