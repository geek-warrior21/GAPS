export const APP_VERSION = "0.1.0" as const;

export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}
