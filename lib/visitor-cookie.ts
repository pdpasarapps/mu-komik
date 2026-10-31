export const ANALYTICS_VISITOR_COOKIE_NAME = "mu_analytics_visitor";
export const ANALYTICS_VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const visitorIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isVisitorId(value: string | null | undefined): value is string {
  return typeof value === "string" && visitorIdPattern.test(value);
}

export function createVisitorId() {
  return crypto.randomUUID();
}
