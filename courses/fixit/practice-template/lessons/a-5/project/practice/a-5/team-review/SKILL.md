---
name: team-review
description: The Millbrook Fixers' review of a change to the website, its pages and its link checker. Use on a pull request's diff, the same way on a laptop and in CI.
---

Review the change on this branch against the base branch, and change no file.

1. Read the change with `git diff origin/main...HEAD`, or against the base branch you are given.
2. Run the link checker on the sample pages with `npm --prefix project run linkcheck -- samples`, and report each broken link it names.
3. For each claim a page makes about the venue, such as the room, the access or the number of places, say which file in the repository supports it, or that nothing does.

Report each finding as `file:line` and why. If you find nothing, say so in one line.
