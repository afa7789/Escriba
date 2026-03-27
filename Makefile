.PHONY: serve lint lint-fix test test-watch clean install

install:
	npm install

serve:
	npx serve .

lint:
	npx eslint src/ worker.js

lint-fix:
	npx eslint src/ worker.js --fix

test:
	npx web-test-runner 'tests/**/*.test.js' --node-resolve --playwright --browsers chromium

test-watch:
	npx web-test-runner 'tests/**/*.test.js' --node-resolve --playwright --browsers chromium --watch

clean:
	rm -rf node_modules

build: lint test
	@echo "Lint + tests passed."

run: serve
