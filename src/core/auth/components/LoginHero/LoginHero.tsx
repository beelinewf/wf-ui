import React from 'react';

import { Box, Stack, Text, Title } from '@mantine/core';

import { BrandMark } from '@common/component/BrandMark';
import { WingPattern } from '@common/component/WingPattern';

import classes from './LoginHero.module.scss';

export const LoginHero: React.FC = () => {
	return (
		<Box p={{ base: 'lg', lg: 48 }} className={classes.root}>
			<WingPattern className={classes.pattern} />

			<Stack h="100%" justify="space-between" gap="xl" className={classes.content}>
				<BrandMark size={52} tone="dark" />

				<Box>
					<Title order={2} fz={{ base: 28, lg: 40 }} className={classes.title}>
						Workflows,
						<br />
						in a straight line.
					</Title>
					<Text fz="md" className={classes.description}>
						Design, run and monitor your workflows from one place.
					</Text>
				</Box>
			</Stack>
		</Box>
	);
};
