# Contributing to Rams @Elec Intelligence Platform

## Commit Discipline

- Commit after every feature, not in bulk
- Use conventional commit prefixes:
  - `feat:` — new feature
  - `fix:` — bug fix
  - `docs:` — documentation
  - `refactor:` — code restructuring
  - `test:` — adding tests
  - `chore:` — maintenance tasks

## Branch Strategy

- `main` — production-ready code
- `feat/module-X-name` — feature branches
- `fix/description` — bug fix branches

## Pull Request Process

1. Create a feature branch from `main`
2. Implement the feature with tests
3. Ensure CI passes (lint, test, build)
4. Open a PR using the PR template
5. Get review before merging

## Module Progress

Update the module progress table in `README.md` as each module is completed.

## Build Journal

Keep a build journal (`docs/build-journal.md`) updated after each module with:
- What was built
- Key decisions made
- Challenges encountered
- Lessons learned

## Project Context

Update `CLAUDE.md` in the same commit as any change to architecture, conventions, or module
status. It is the context an assistant (or a returning contributor) loads first, and it is the
only record that survives between sessions.
