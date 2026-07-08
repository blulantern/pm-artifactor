/**
 * True when a thrown error is Prisma's "record not found" (P2025, e.g. from
 * `findUniqueOrThrow`). Duck-typed on the `code` field so pages can distinguish
 * a genuine 404 from a real DB/connectivity error — the latter must propagate,
 * not masquerade as "not found".
 */
export function isRecordNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2025"
  );
}
