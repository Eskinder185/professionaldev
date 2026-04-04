/**
 * Theme & design system — import from `src/theme` in app code when you need tokens in TS.
 *
 * @example
 * import { designSystem, tokens } from "../theme";
 * className={designSystem.layout.container}
 */
export { designSystem, type DesignSystem } from "./designSystem";
export { tokens, type DesignTokens } from "./tokens";
export { cardTokens, cardLayout } from "./cardTokens";
