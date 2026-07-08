const htmlEntityText = new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["quot", "\""],
  ["apos", "'"],
  ["#39", "'"],
  ["lt", " "],
  ["gt", " "]
]);

function stripMarkup(value) {
  let depth = 0;
  let output = "";

  for (const char of String(value || "")) {
    if (char === "<") {
      depth += 1;
      output += " ";
      continue;
    }

    if (char === ">") {
      if (depth > 0) {
        depth -= 1;
      }
      output += " ";
      continue;
    }

    if (depth === 0) {
      output += char;
    }
  }

  return output;
}

function decodeVisibleEntities(value) {
  return String(value || "").replace(/&(?:nbsp|amp|quot|apos|#39|lt|gt);/gi, (entity) => {
    const name = entity.slice(1, -1).toLowerCase();
    return htmlEntityText.get(name) || " ";
  });
}

export function cleanText(value) {
  return decodeVisibleEntities(stripMarkup(value))
    .replace(/\s+/g, " ")
    .trim();
}

export function stripPriceText(value) {
  return cleanText(value)
    .replace(/(?:\b(?:AUD|USD|CAD|NZD|EUR|GBP)\b\s*)?(?:A\$|AU\$|NZ\$|US\$|CA\$|\$|€|£)\s*\d[\d,.]*(?:\.\d{2})?(?:\s*\b(?:AUD|USD|CAD|NZD|EUR|GBP)\b)?/gi, " ")
    .replace(/\bPrice\s*TBA\b/gi, " ")
    .replace(/\s*[-–—:|]\s*$/g, " ")
    .replace(/^\s*[-–—:|]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
