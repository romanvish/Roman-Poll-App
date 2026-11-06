import { createHash, timingSafeEqual } from "node:crypto";

export function isValidCronBearer(header: string | null, configuredSecret: string | undefined): boolean {
  const supplied = header?.match(/^Bearer (.+)$/)?.[1];
  if (!configuredSecret || configuredSecret.length < 32 || !supplied) return false;
  const expectedDigest = createHash("sha256").update(configuredSecret).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedDigest, suppliedDigest);
}
