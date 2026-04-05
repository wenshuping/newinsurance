# Workspace Rules

This workspace contains multiple similarly named frontend projects. Do not guess which one is active.

## Canonical Local Dev Targets

- Active C app source: `/Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full`
- Active B app source: `/Users/wenshuping/Documents/new_insurance2/insurance_code_B`
- Active P app source: `/Users/wenshuping/Documents/new_insurance2/insurance_code_P`
- Stack entrypoint: `/Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full/scripts/dev-start-all.mjs`

## Required Workflow

1. Before editing, confirm which source directories are currently serving ports `3003`, `3004`, `3005`.
2. For local stack work, treat `insurance_code/insurance_code_full` as the only valid C-side edit target.
3. Do not modify `/Users/wenshuping/Documents/new_insurance2/insurance_code/src` for changes that are expected to appear on port `3003`, unless the user explicitly asks to edit the legacy/simple app.
4. After edits, validate in the same project you changed.

## Port Mapping

- `3003` -> C app from `insurance_code/insurance_code_full`
- `3004` -> B app from `insurance_code_B`
- `3005` -> P app from `insurance_code_P`
- `4000` -> API v1 from `insurance_code/insurance_code_full`
- `4100` -> Gateway from `insurance_code/insurance_code_full`

## Human Check

If there is any doubt, run the local stack from `insurance_code/insurance_code_full` and read the startup log lines beginning with:

- `[dev-start-all] source C=...`
- `[dev-start-all] source B=...`
- `[dev-start-all] source P=...`
