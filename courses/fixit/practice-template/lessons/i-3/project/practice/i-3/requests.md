# Requests for the next release of the link checker

One of these goes into this release. Each is a small change to the checker's code in `src/`.

1. **Sun-hee:** A page with a malformed percent escape, such as a link to `bad%.md`, crashes the checker. Report it as a broken link instead of crashing.
2. **Tomás:** Some of our older pages end in `.markdown`, and the checker skips them. Check `.markdown` files as well as `.md` ones.
3. **Lin:** When the checker reports a broken link, I have to open the file to see which page it is. Print the page title next to each broken link.
