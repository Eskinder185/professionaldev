/**
 * Query a document and every OPEN shadow root inside it.
 *
 * Many modern application forms are built from web components whose inputs live in shadow roots,
 * where document.querySelector cannot see them. Closed shadow roots are, by design, unreachable
 * and are skipped; nothing here tries to bypass that boundary.
 */

type Root = Document | ShadowRoot | Element;

const MAX_ROOTS = 200;

function shadowRootsIn(root: Root): ShadowRoot[] {
  const found: ShadowRoot[] = [];
  const queue: Root[] = [root];
  while (queue.length && found.length < MAX_ROOTS) {
    const current = queue.shift()!;
    const hosts = current.querySelectorAll("*");
    for (const host of Array.from(hosts)) {
      const shadow = (host as Element).shadowRoot;
      if (shadow) {
        found.push(shadow);
        queue.push(shadow);
      }
    }
    // An element can itself be a host.
    if (current instanceof Element && current.shadowRoot && !found.includes(current.shadowRoot)) {
      found.push(current.shadowRoot);
      queue.push(current.shadowRoot);
    }
  }
  return found;
}

/** Every element matching `selector` in `root` and its open shadow roots, in document order per root. */
export function deepQueryAll<T extends Element = HTMLElement>(root: Root, selector: string): T[] {
  const results = Array.from(root.querySelectorAll<T>(selector));
  for (const shadow of shadowRootsIn(root)) results.push(...Array.from(shadow.querySelectorAll<T>(selector)));
  return results;
}

/** The first element matching `selector` in `root`, then in any open shadow root. */
export function deepQuery<T extends Element = HTMLElement>(root: Root, selector: string): T | null {
  const direct = root.querySelector<T>(selector);
  if (direct) return direct;
  for (const shadow of shadowRootsIn(root)) {
    const hit = shadow.querySelector<T>(selector);
    if (hit) return hit;
  }
  return null;
}

/** True when the element lives inside a shadow root. */
export const isInShadowRoot = (el: Element): boolean => typeof ShadowRoot !== "undefined" && el.getRootNode() instanceof ShadowRoot;

/** Number of open shadow roots under `root` (used to know whether it is worth observing them). */
export const countShadowRoots = (root: Root): number => shadowRootsIn(root).length;
export { shadowRootsIn };
