# Millbrook Fixers website

The pages the Millbrook Fixers publish for each Fix-It Saturday, and the link checker that runs on them before Maya posts them.

- `npm run linkcheck -- <folder>` checks the relative links in a folder's Markdown pages.
- `npm test` runs the checker's tests.
- `samples/` holds copies of the March events page and the booking page.

This folder, `project/`, sits one level below the repository's root. GitHub reads workflows only from the root's `.github/workflows/`, so a workflow that runs the checker names this folder, as in `npm --prefix project run linkcheck -- samples`.
