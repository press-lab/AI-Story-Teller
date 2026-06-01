export const PE_PRESSURE_HEADING = "## Active Pressure";
export const PE_MOMENTUM_HEADING = "## Immediate Momentum";

type PeZone = "arc" | "pressure" | "momentum";

/** Extract content for a specific zone. Returns empty string if zone not present. */
export function extractPeZone(content: string, zone: PeZone): string {
  if (zone === "arc") {
    const idx = findFirstZoneHeading(content);
    return idx === -1 ? content.trim() : content.slice(0, idx).trim();
  }
  const heading = zone === "pressure" ? PE_PRESSURE_HEADING : PE_MOMENTUM_HEADING;
  return extractZoneContent(content, heading);
}

/** Replace or insert a zone section. Arc zone appends to arc content. Pressure/momentum replace their section. */
export function applyPeZone(existing: string, zone: PeZone, newContent: string): string {
  if (zone === "arc") {
    const idx = findFirstZoneHeading(existing);
    const arcPart = idx === -1 ? existing.trim() : existing.slice(0, idx).trim();
    const rest = idx === -1 ? "" : existing.slice(idx);
    const newArc = arcPart ? `${arcPart}\n${newContent}` : newContent;
    return rest ? `${newArc}\n\n${rest.trim()}` : newArc;
  }
  const heading = zone === "pressure" ? PE_PRESSURE_HEADING : PE_MOMENTUM_HEADING;
  return replaceZoneContent(existing, heading, newContent);
}

function findFirstZoneHeading(content: string): number {
  const pi = content.indexOf(PE_PRESSURE_HEADING);
  const mi = content.indexOf(PE_MOMENTUM_HEADING);
  if (pi === -1 && mi === -1) return -1;
  if (pi === -1) return mi;
  if (mi === -1) return pi;
  return Math.min(pi, mi);
}

function extractZoneContent(content: string, heading: string): string {
  const start = content.indexOf(heading);
  if (start === -1) return "";
  const afterHeading = content.indexOf("\n", start);
  if (afterHeading === -1) return "";
  const bodyStart = afterHeading + 1;
  const nextHeadingIdx = findNextHeading(content, bodyStart);
  const body = nextHeadingIdx === -1 ? content.slice(bodyStart) : content.slice(bodyStart, nextHeadingIdx);
  return body.trim();
}

function replaceZoneContent(content: string, heading: string, newContent: string): string {
  const start = content.indexOf(heading);
  if (start === -1) {
    // Zone doesn't exist yet — append it
    return `${content.trim()}\n\n${heading}\n${newContent}`;
  }
  const afterHeading = content.indexOf("\n", start);
  const bodyStart = afterHeading === -1 ? content.length : afterHeading + 1;
  const nextHeadingIdx = findNextHeading(content, bodyStart);
  const before = content.slice(0, bodyStart);
  const after = nextHeadingIdx === -1 ? "" : content.slice(nextHeadingIdx);
  return after ? `${before}${newContent}\n\n${after.trim()}` : `${before}${newContent}`;
}

function findNextHeading(content: string, fromIndex: number): number {
  const idx = content.indexOf("\n## ", fromIndex);
  return idx === -1 ? -1 : idx + 1;
}
