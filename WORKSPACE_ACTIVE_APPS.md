# Active App Map

Use this file as the source of truth when choosing which project to edit.

## Active local stack

- C app: [insurance_code_full](/Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full)
- B app: [insurance_code_B](/Users/wenshuping/Documents/new_insurance2/insurance_code_B)
- P app: [insurance_code_P](/Users/wenshuping/Documents/new_insurance2/insurance_code_P)
- API/Gateway: [insurance_code_full](/Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full)

## Do not use by default

- Legacy/simple C app: [insurance_code](/Users/wenshuping/Documents/new_insurance2/insurance_code)

This legacy `insurance_code` directory is not the default source for port `3003`.
If the task says “modify the running C app”, edit `insurance_code/insurance_code_full`.

## Recommended startup

```bash
cd /Users/wenshuping/Documents/new_insurance2/insurance_code/insurance_code_full
npm run dev:stack:restart
```

Startup logs now print the real source directories for `C/B/P`. Always confirm those lines before editing.
