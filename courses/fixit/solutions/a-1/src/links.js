// Finds inline Markdown links, [text](target), outside code blocks and
// HTML comments.
export function findLinks(markdown) {
  const links = [];
  let inFence = false;
  // A comment may span lines: blank it out, keeping its line breaks, so the
  // links after it keep their line numbers.
  const text = markdown.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
  text.split('\n').forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const prose = line.replace(/`[^`]*`/g, '');
    // The target may sit in angle brackets and may be followed by a title.
    for (const m of prose.matchAll(/(?<!!)\[([^\]]*)\]\(\s*(?:<([^>]*)>|([^)\s]+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g)) {
      links.push({ text: m[1], target: m[2] ?? m[3], line: i + 1 });
    }
  });
  return links;
}

export function isExternal(target) {
  return /^[a-z][a-z0-9+.-]*:/i.test(target);
}
