# Website jobs before Friday

From Ade, Fri 28 May. Each job says which files it changes.

1. **Ignore links inside HTML comments.** The checker reports links in our editors' notes, such as Sam's note at the top of `pages/schedule.md`, as broken. `findLinks` in `src/links.js` should skip anything between `<!--` and `-->`, on one line or several. Changes `src/links.js` and its test, `test/links.test.js`.
2. **Test the summer dates on the schedule page.** Nothing checks that `pages/schedule.md` still shows Sat 12 June, Sat 10 July and Sat 14 August. Adds a new test in `test/`. Changes no code.
3. **Rename `findLinks` to `extractLinks`.** Clearer name. Changes `src/links.js`, `src/check-links.js` and `test/links.test.js`.
