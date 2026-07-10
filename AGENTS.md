# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## Automatic tag-and-publish-on-master release workflow

`.github/workflows/main-CI.yml`'s `publish` job (`needs: build`, runs only on `push` to
`master`) reads the version from `pyproject.toml` (`poetry version -s`) and independently
checks both for its git tag and for an existing PyPI release (`curl` to
`https://pypi.org/pypi/foursight-core/<version>/json`; only HTTP 200/404 are treated as
present/absent, anything else fails the job closed). It creates the tag only if missing and
publishes only if PyPI doesn't already have the version, in the same job run. It deliberately
does not rely on `.github/workflows/main-publish.yml`'s tag-triggered `on: push: tags` event,
because GitHub Actions does not start a new workflow run from a tag pushed with the default
`GITHUB_TOKEN` (anti-recursion rule) — `main-publish.yml` remains for manual/
`workflow_dispatch` publishing only.

`make build-for-ga` uses `POETRY_VIRTUALENVS_CREATE=true poetry install`, never
`poetry config --local virtualenvs.create true` — the latter rewrites the tracked
`poetry.toml` (`[virtualenvs] create = false`), dirtying the release checkout and making
`publish-to-pypi`'s clean-tree check fail. The workflow also asserts `git diff --exit-code`
right after dependency install so a future regression here fails loud with the filename.
`publish-to-pypi` (from `dcicutils.scripts.publish_to_pypi`) tolerates exactly one dirty
file named `gitinfo.json`, which is why the `publish` job (like `main-publish.yml`) writes
`foursight_core/gitinfo.json` with the release commit info right before publishing — any
other tracked-file diff still fails the check.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
