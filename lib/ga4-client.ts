type Ga4EventValue = string | number | boolean;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (
      ...args: unknown[]
    ) => void;
  }
}

export function trackGa4Event(
  eventName: string,
  parameters: Record<string, Ga4EventValue>,
) {
  if (typeof window === "undefined") return;
  window.dataLayer ??= [];
  window.gtag ??= (...args) => { window.dataLayer?.push(args); };
  window.gtag?.("event", eventName, parameters);
}
