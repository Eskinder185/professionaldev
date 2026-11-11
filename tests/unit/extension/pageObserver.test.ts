// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPageObserver, pageSignature } from "../../../apps/extension/src/page-intelligence/pageObserver";

const flushMutations = () => Promise.resolve().then(() => Promise.resolve());

const created: Array<{ stop(): void }> = [];

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<h1>Apply</h1><form><input name="first_name" /></form>';
});
afterEach(() => {
  // Every observer started in a test is stopped, so none leaks into the next one.
  created.splice(0).forEach((instance) => instance.stop());
  vi.useRealTimers();
});

function observer(overrides: Partial<Parameters<typeof createPageObserver>[0]> = {}) {
  const changes: string[] = [];
  const instance = createPageObserver({ doc: document, win: window, onChange: (reason) => changes.push(reason), throttleMs: 700, ...overrides });
  created.push(instance);
  instance.start();
  return { instance, changes };
}
const addField = (name: string) => {
  const input = document.createElement("input");
  input.name = name;
  document.querySelector("form")!.append(input);
};

describe("pageSignature", () => {
  it("changes when fields or the heading change, not when the user types", () => {
    const before = pageSignature(document, "https://x.test/a");
    (document.querySelector("input") as HTMLInputElement).value = "typing…";
    expect(pageSignature(document, "https://x.test/a")).toBe(before);
    addField("email");
    expect(pageSignature(document, "https://x.test/a")).not.toBe(before);
    expect(pageSignature(document, "https://x.test/b")).not.toBe(pageSignature(document, "https://x.test/a"));
  });

  it("ignores hidden controls", () => {
    const before = pageSignature(document, "u");
    const hidden = document.createElement("input");
    hidden.name = "secret";
    hidden.hidden = true;
    document.querySelector("form")!.append(hidden);
    expect(pageSignature(document, "u")).toBe(before);
  });

  it("includes fields inside open shadow roots", () => {
    const before = pageSignature(document, "u");
    const host = document.createElement("div");
    document.body.append(host);
    host.attachShadow({ mode: "open" }).innerHTML = '<input name="shadow_field" />';
    expect(pageSignature(document, "u")).not.toBe(before);
  });
});

describe("page observer", () => {
  it("reports a changed form once after a burst of mutations", async () => {
    const { changes } = observer();
    addField("a");
    addField("b");
    addField("c");
    await flushMutations();
    expect(changes).toEqual([]); // nothing until the throttle elapses
    vi.advanceTimersByTime(700);
    expect(changes).toEqual(["dom"]);
  });

  it("stays quiet when something changes that does not affect the form", async () => {
    const { changes } = observer();
    document.body.append(document.createElement("div"));
    document.querySelector("h1")!.setAttribute("class", "big");
    await flushMutations();
    vi.advanceTimersByTime(2000);
    expect(changes).toEqual([]);
  });

  it("notices a new step of a multi-step application", async () => {
    const { changes } = observer();
    document.querySelector("form")!.innerHTML = '<input name="resume" type="file" /><input name="linkedin" type="url" />';
    document.querySelector("h1")!.textContent = "Step 2: Documents";
    await flushMutations();
    vi.advanceTimersByTime(700);
    expect(changes).toEqual(["dom"]);
  });

  it("does no work while the tab is hidden, and catches up when it is shown again", async () => {
    let visibility: DocumentVisibilityState = "hidden";
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
    const { changes } = observer();
    addField("hiddenTabField");
    await flushMutations();
    vi.advanceTimersByTime(2000);
    expect(changes).toEqual([]);
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(700);
    expect(changes).toEqual(["visible"]);
  });

  it("caps reports per minute so a noisy page cannot flood the panel", async () => {
    const { changes } = observer({ maxPerMinute: 3, throttleMs: 100 });
    for (let i = 0; i < 10; i++) {
      addField(`f${i}`);
      await flushMutations();
      vi.advanceTimersByTime(100);
    }
    expect(changes).toHaveLength(3);
  });

  it("notices fields added inside an open shadow root that appeared after it started", async () => {
    const { changes } = observer();
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    await flushMutations();
    vi.advanceTimersByTime(700); // observes the new root
    changes.length = 0;
    shadow.innerHTML = '<input name="late" />';
    await flushMutations();
    vi.advanceTimersByTime(700);
    expect(changes).toEqual(["dom"]);
  });

  it("reports an address change from history navigation", () => {
    const { changes, instance } = observer();
    window.history.pushState({}, "", "/apply/step-2");
    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(700);
    expect(changes).toEqual(["url"]);
    instance.stop();
  });

  it("stops completely: no listeners, no timers, no reports", async () => {
    const { changes, instance } = observer();
    instance.stop();
    expect(instance.active).toBe(false);
    addField("after-stop");
    await flushMutations();
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new PopStateEvent("popstate"));
    vi.advanceTimersByTime(5000);
    expect(changes).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never polls: with no changes, no timer is ever scheduled", () => {
    observer();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
