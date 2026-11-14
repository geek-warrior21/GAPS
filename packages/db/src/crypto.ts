import { createHash, scryptSync, timingSafeEqual } from "node:crypto";

const SALT = "gaps_pilot_salt_2026";

export function hashPin(pin: string): string {
  return createHash("sha256").update(`${SALT}:pin:${pin}`).digest("hex");
}

export function hashPassword(password: string): string {
  return scryptSync(password, SALT, 32).toString("hex");
}

export function verifyPin(pin: string, hash: string): boolean {
  const computed = hashPin(pin);
  return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}

export function verifyPassword(password: string, hash: string): boolean {
  const computed = hashPassword(password);
  return timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
}
