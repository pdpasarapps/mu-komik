export type Ga4DimensionRow = { dimension: string; activeUsers: number; sessions: number };
export type Ga4RealtimeRow = { dimension: string; activeUsers: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseDimensionRows(value: unknown): Ga4DimensionRow[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((row): Ga4DimensionRow[] => (
    isRecord(row) && typeof row.dimension === "string"
      && typeof row.activeUsers === "number" && typeof row.sessions === "number"
      ? [{ dimension: row.dimension, activeUsers: row.activeUsers, sessions: row.sessions }]
      : []
  ));
}

export function parseRealtimeRows(value: unknown): Ga4RealtimeRow[] | null {
  if (!Array.isArray(value)) return null;
  return value.flatMap((row): Ga4RealtimeRow[] => (
    isRecord(row) && typeof row.dimension === "string" && typeof row.activeUsers === "number"
      ? [{ dimension: row.dimension, activeUsers: row.activeUsers }]
      : []
  ));
}
