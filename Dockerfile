# syntax=docker/dockerfile:1.7

FROM --platform=$BUILDPLATFORM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN --mount=type=cache,target=/root/.npm \
	npm ci --no-audit --no-fund

COPY . .

ARG APP_VERSION=dev

RUN APP_VERSION="$APP_VERSION" npm run build

FROM openresty/openresty:1.27.1.2-0-alpine AS runtime

ENV BEELINE_UI_NAME="Beeline" \
	BEELINE_UI_API="http://localhost:9999" \
	BEELINE_UI_ORG_URL="https://github.com/beelinewf"

COPY <<'EOF' /etc/nginx/conf.d/default.conf
init_by_lua_block {
	local cjson = require "cjson.safe"
	local config = {}

	local fh = io.open("/proc/self/environ", "rb")
	if fh then
		local environ = fh:read("*a")
		fh:close()
		for entry in environ:gmatch("[^%z]+") do
			local key, value = entry:match("^(BEELINE_UI_[A-Za-z0-9_]*)=(.*)$")
			if key then
				config[key] = value
			end
		end
	end

	CONFIG_JSON = cjson.encode(config) or "{}"
}

server {
	listen 80;
	server_name _;
	root /usr/local/openresty/nginx/html;
	index index.html;

	location = /config.json {
		default_type application/json;
		add_header Cache-Control "no-store";
		content_by_lua_block {
			ngx.print(CONFIG_JSON)
		}
	}

	location /assets/ {
		expires 1y;
		add_header Cache-Control "public, immutable";
		try_files $uri =404;
	}

	location / {
		add_header Cache-Control "no-cache";
		try_files $uri $uri/ /index.html;
	}
}
EOF

COPY --from=build /app/dist /usr/local/openresty/nginx/html

EXPOSE 80

CMD ["openresty", "-g", "daemon off;"]
