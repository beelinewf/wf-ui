export type ConfigValue = {
	BEELINE_UI_NAME: string;
	BEELINE_UI_API: string;
	/** Optional link to where role assignments are managed in the identity provider. */
	BEELINE_UI_IDP_ADMIN_URL: string;
	/** Optional link behind the copyright holder on the login page. */
	BEELINE_UI_ORG_URL: string;
};

export class Config {
	private isReady = false;

	private pending: Promise<void> | null = null;

	private config: ConfigValue = {
		BEELINE_UI_NAME: '',
		BEELINE_UI_API: '',
		BEELINE_UI_IDP_ADMIN_URL: '',
		BEELINE_UI_ORG_URL: '',
	};

	public async fetchConfigFile() {
		if (this.isReady) return;
		this.pending ??= this.load();
		await this.pending;
	}

	public async getValue() {
		if (!this.isReady) {
			throw new Error('Config is not ready');
		}
		return this.config;
	}

	/** Synchronous read for render code; main.tsx loads the config before the app mounts. */
	public get value() {
		if (!this.isReady) {
			throw new Error('Config is not ready');
		}
		return this.config;
	}

	private async load() {
		try {
			const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
			if (!res.ok) {
				throw new Error(`Failed to fetch config.json: ${res.status}`);
			}

			const value = (await res.json()) as Partial<ConfigValue>;
			this.config = { ...this.config, ...value };
			// A relative API path (e.g. "/") targets the current origin, which the dev proxy forwards to the backend.
			this.config.BEELINE_UI_API = new URL(this.config.BEELINE_UI_API || '/', window.location.origin).toString();
			this.isReady = true;
		} finally {
			this.pending = null;
		}
	}
}

export const config = new Config();
