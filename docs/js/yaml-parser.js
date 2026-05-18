/**
 * Minimal YAML parser for BoodschappenBaas data format.
 * Supports: top-level keys, list-of-objects, scalar values, inline arrays.
 * Does NOT support: multi-line strings, anchors, or complex nested structures.
 */

/**
 * Parse a YAML string into a plain JavaScript object.
 * @param {string} text
 * @returns {Object}
 */
export function parseYAML(text) {
  const lines = text.split('\n');
  const result = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // Top-level key (no leading spaces)
    if (!line.startsWith(' ') && line.includes(':')) {
      const colonIdx = line.indexOf(':');
      const key = line.slice(0, colonIdx).trim();
      const rest = line.slice(colonIdx + 1).trim();

      if (rest === '') {
        // Value is a block (list or object) on following lines
        const [value, newI] = parseBlock(lines, i + 1);
        result[key] = value;
        i = newI;
      } else {
        result[key] = parseScalar(rest);
        i++;
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Parse an indented block starting at lineIndex.
 * Returns [value, nextLineIndex].
 * @param {string[]} lines
 * @param {number} start
 * @returns {[Array|Object, number]}
 */
function parseBlock(lines, start) {
  // Find first non-empty line to determine block type
  let i = start;
  while (i < lines.length && !lines[i].trim()) i++;

  if (i >= lines.length || !lines[i].startsWith(' ')) {
    return [null, i];
  }

  // Check if block is a list (starts with '  - ')
  if (lines[i].match(/^ +- /)) {
    return parseList(lines, i);
  }

  return [null, i];
}

/**
 * Parse a YAML list block (sequences of '  - ...' items).
 * @param {string[]} lines
 * @param {number} start
 * @returns {[Array, number]}
 */
function parseList(lines, start) {
  const list = [];
  let i = start;
  // Detect indent level of list items
  const itemIndent = lines[i].match(/^( +)- /)[1].length;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // Check if this line is a list item at our indent level
    const itemMatch = line.match(new RegExp(`^( {${itemIndent}})- (.*)`));
    if (itemMatch) {
      const rest = itemMatch[2].trim();

      if (rest.includes(':')) {
        // Inline first property of object
        const colonIdx = rest.indexOf(':');
        const key = rest.slice(0, colonIdx).trim();
        const val = rest.slice(colonIdx + 1).trim();
        const obj = {};
        if (key) obj[key] = parseScalar(val);

        // Read further properties (indented more than the '- ')
        i++;
        const propIndent = itemIndent + 2; // 2 more than item start
        while (i < lines.length) {
          const propLine = lines[i];
          const propTrimmed = propLine.trim();

          if (!propTrimmed || propTrimmed.startsWith('#')) {
            i++;
            continue;
          }

          // If line is at prop indent level and has a colon, it's a property
          const propMatch = propLine.match(
            new RegExp(`^( {${propIndent}})([a-zA-Z_][a-zA-Z0-9_ ]*):\\s*(.*)`)
          );
          if (propMatch) {
            const pKey = propMatch[2].trim();
            const pVal = propMatch[3].trim();
            obj[pKey] = parseScalar(pVal);
            i++;
          } else {
            break;
          }
        }
        list.push(obj);
      } else {
        // Simple scalar value
        list.push(parseScalar(rest));
        i++;
      }
    } else if (line.length > 0 && !line.startsWith(' '.repeat(itemIndent))) {
      // Back to parent level
      break;
    } else {
      i++;
    }
  }

  return [list, i];
}

/**
 * Parse a scalar value: inline array, or plain string.
 * @param {string} value
 * @returns {string|string[]}
 */
function parseScalar(value) {
  const v = value.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  // Strip optional surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}
