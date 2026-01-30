import { z } from "zod";
import type { ComponentType } from "react";

// ============================================================================
// INLINE GENERATIVE UI TYPES
// ============================================================================

/**
 * Base props that all inline generative UI components receive
 */
export interface InlineUIBaseProps {
  /** Callback when user interacts with the component */
  onAction?: (action: string, payload: unknown) => void;
}

/**
 * Registration entry for an inline UI component
 * Uses loose typing to allow storage in a Map while components maintain their own types
 */
export interface InlineUIRegistration {
  /** Zod schema for validating component props */
  schema: z.ZodType;
  /** The React component to render */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  /** Human-readable description for the system prompt */
  description: string;
  /** Example usage for the system prompt */
  example: string;
}

/**
 * Registry type - maps component names to their registrations
 */
export type InlineUIRegistry = Record<string, InlineUIRegistration>;
