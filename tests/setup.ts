/// <reference types="@testing-library/jest-dom/vitest" />
import * as matchers from "@testing-library/jest-dom/matchers";
import { beforeEach, expect } from "vitest";

// Register jest-dom's matchers on *this* suite's `expect`. Importing "@testing-library/jest-dom/vitest"
// instead makes jest-dom load its own `vitest` instance, which is a different module under some Windows
// path-casing conditions, so the matchers never reach the tests ("Invalid Chai property").
expect.extend(matchers);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
