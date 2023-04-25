.PHONY: test

configure:  # does any pre-requisite installs
	pip install poetry

lint:
	@echo "Running flake8..."
	@flake8 foursight_core || echo "'flake8 foursight_core' failed."
	@flake8 tests || echo "'flake8 tests' failed."

build:  react
	make configure
	poetry install

update:
	poetry update

test:
	pytest -vv -m "not integrated" && pytest -vv -m "integrated"

test-for-ga:
	make test

publish:
	# New Python based publish script in dcicutils (2023-04-25).
	# python -m dcicutils.scripts.publish_to_pypi
	poetry run publish-to-pypi

publish-for-ga:
	# New Python based publish script in dcicutils (2023-04-25).
	# pip install dcicutils==7.3.0.1b17
	# python -m dcicutils.scripts.publish_to_pypi --noconfirm
	poetry run publish-to-pypi --noconfirm

.PHONY: react

react:
	scripts/react_build.sh

react-run-local:
	cd react ; npm start

info:
	@: $(info Here are some 'make' options:)
	   $(info - Use 'make configure' to install poetry, though 'make build' will do it automatically.)
	   $(info - Use 'make build' to install dependencies using poetry.)
	   $(info - Use 'make test' to run tests with the normal options we use on travis)
	   $(info - Use 'make publish' to publish this library manually.)
	   $(info - Use 'make update' to update dependencies)
