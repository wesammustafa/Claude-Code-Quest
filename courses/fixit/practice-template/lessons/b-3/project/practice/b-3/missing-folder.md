# Bug: a missing folder in linkcheck.json is skipped without a word

**Reported by:** Sun-hee

## What happens

I set up a `linkcheck.json` with this in it:

```json
{ "files": ["docs"] }
```

There is no `docs` folder. `npm run linkcheck -- <that folder>` printed `All relative links resolve.` and exited with code 0. The checker said everything was fine.

## What should happen

It should stop with an error that names the missing folder, `docs`, and exit with code 2, the code it already uses for a broken `linkcheck.json`.
