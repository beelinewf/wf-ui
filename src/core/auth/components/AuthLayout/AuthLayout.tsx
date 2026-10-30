import React from 'react';

import { Anchor, Box, Container, Flex, Group, Stack, Text, Title } from '@mantine/core';

import { config } from '@config/config';

import { LoginHero } from '@core/auth/components/LoginHero';

import { BrandMark } from '@common/component/BrandMark';

import classes from './AuthLayout.module.scss';

const COPYRIGHT_HOLDER = 'BeelineWF And Contributors';

interface AuthLayoutProps {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	children: React.ReactNode;
}

/** The signed-out shell: a centered form column beside the brand hero. Shared by login, register and verify. */
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, children }) => {
	const { BEELINE_UI_ORG_URL: orgUrl } = config.value;

	return (
		<Flex p={{ base: 'md', md: 'lg' }} gap="lg" className={classes.root}>
			<Stack flex={1} gap="xl" className={classes.panel}>
				<Box hiddenFrom="md">
					<BrandMark size={40} />
				</Box>

				<Container size={420} w="100%" flex={1} px={0}>
					<Flex className={classes.formWrapper}>
						<Box className={classes.form}>
							<Title order={1} className={classes.title}>
								{title}
							</Title>
							{subtitle && (
								<Text c="dimmed" fz="sm" className={classes.subtitle}>
									{subtitle}
								</Text>
							)}

							<Box className={classes.body}>{children}</Box>
						</Box>
					</Flex>
				</Container>

				<Group justify="space-between" wrap="wrap" gap="xs">
					<Text fz="xs" c="dimmed">
						Copyright &copy; 2026{' '}
						{orgUrl ? (
							<Anchor fz={'xs'} target="_blank" href={orgUrl}>
								{COPYRIGHT_HOLDER}
							</Anchor>
						) : (
							COPYRIGHT_HOLDER
						)}
					</Text>
				</Group>
			</Stack>

			<Box flex={1} visibleFrom="md">
				<LoginHero />
			</Box>
		</Flex>
	);
};
