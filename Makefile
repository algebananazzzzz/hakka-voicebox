.PHONY: install dev preview build check test format

# Local password for the studio; wrangler dev reads it from .dev.vars.
.dev.vars:
	echo 'MANAGE_PASSWORD=dev' > .dev.vars

node_modules: package-lock.json
	npm ci
	@touch node_modules

install: node_modules

# Astro on http://localhost:4321 with hot reload; it proxies /api and /media to the
# Worker on :8787, which keeps its R2 data in .wrangler/ between runs.
# --ignore-lock keeps Astro in the foreground: when it detects an AI agent it otherwise
# detaches, and concurrently would take that exit as a reason to stop the Worker.
dev: node_modules .dev.vars
	@mkdir -p dist
	npx concurrently --kill-others --names worker,astro --prefix-colors yellow,cyan \
		"wrangler dev --port 8787" \
		"astro dev --port 4321 --ignore-lock"

# The production build served the way Cloudflare serves it, on http://localhost:8787.
preview: node_modules .dev.vars build
	npx wrangler dev --port 8787

build: node_modules
	npx astro build

check: node_modules
	npm run format:check
	npm run check

test: node_modules
	@mkdir -p dist
	npm test

format: node_modules
	npm run format
