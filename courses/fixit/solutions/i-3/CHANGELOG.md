# Changelog

What changed in the link checker, for the volunteers who run it before Maya posts a page.

## Unreleased

- Malformed percent escapes such as `bad%.md` are now reported as broken links instead of crashing the checker.

## 1.0.0

- The checker reports each relative link whose file is missing, with its page and line.
- Links in code and images are not checked.
