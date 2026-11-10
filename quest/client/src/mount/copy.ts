import { useSlots } from "./context";

/** The app's name, where a mount names no other product. */
export const PRODUCT_NAME = "Claude Code Quest";

export function useProductName(): string {
  return useSlots().copy?.productName ?? PRODUCT_NAME;
}
