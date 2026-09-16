const LOWER_RUN_RE = /[a-zà-öø-ÿ]+/g;

export function scRuns(text, keyBase) {
  if (typeof text !== 'string' || !/[a-z]/.test(text)) return text;
  const out = [];
  let cursor = 0;
  let idx = 0;
  let m;
  LOWER_RUN_RE.lastIndex = 0;
  while ((m = LOWER_RUN_RE.exec(text)) !== null) {
    if (m.index > cursor) out.push(text.slice(cursor, m.index));
    out.push(
      <span key={`${keyBase}-sc-${idx}`} className="ds-sc-run">
        {m[0]}
      </span>,
    );
    idx += 1;
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

export function scChildren(node, keyBase) {
  if (typeof node === 'string') return scRuns(node, keyBase);
  if (Array.isArray(node)) {
    return node.map((child, i) => (typeof child === 'string' ? scRuns(child, `${keyBase}-${i}`) : child));
  }
  return node;
}
