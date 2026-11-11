export type RetryDisposition = "safe" | "unsafe" | "unknown";
export type DeliveryState = "delivered_verified" | "delivered_unverified" | "not_delivered" | "unknown";

export interface DeliverySemantics {
  delivery: DeliveryState;
  retry: RetryDisposition;
}

export function unknownDelivery(): DeliverySemantics {
  return { delivery: "unknown", retry: "unknown" };
}

export function notDeliveredSafe(): DeliverySemantics {
  return { delivery: "not_delivered", retry: "safe" };
}

export function notDeliveredUnsafe(): DeliverySemantics {
  return { delivery: "not_delivered", retry: "unsafe" };
}

export function deliveredVerified(): DeliverySemantics {
  return { delivery: "delivered_verified", retry: "unsafe" };
}

export function deliveredUnverified(): DeliverySemantics {
  return { delivery: "delivered_unverified", retry: "unsafe" };
}
