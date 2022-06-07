.PHONY: test

configure:  # does any pre-requisite installs
	pip install poetry

lint:
	@echo "Running flake8..."
	@flake8 foursight_core || echo "'flake8 foursight_core' failed."
	@flake8 tests || echo "'flake8 tests' failed."

build:  # builds
	make configure
	poetry install

update:
	poetry update

test:
	pytest -vv --cov foursight_core

test-for-ga:
	poetry run pytest --cov foursight_core -vv -m "not integratedx"

publish:
	scripts/publish

publish-for-ga:
	scripts/publish --noconfirm

info:
	@: $(info Here are some 'make' options:)
	   $(info - Use 'make configure' to install poetry, though 'make build' will do it automatically.)
	   $(info - Use 'make build' to install dependencies using poetry.)
	   $(info - Use 'make test' to run tests with the normal options we use on travis)
	   $(info - Use 'make publish' to publish this library manually.)
	   $(info - Use 'make update' to update dependencies)
