import { describe, expect, it } from "vitest";
import { normalizePhoneIL, isValidEmail } from "./phone";

describe("normalizePhoneIL", () => {
  it("normalizes local mobile", () => {
    expect(normalizePhoneIL("053-530-1669")).toBe("+972535301669");
    expect(normalizePhoneIL("0535301669")).toBe("+972535301669");
    expect(normalizePhoneIL("535301669")).toBe("+972535301669");
  });

  it("accepts E.164", () => {
    expect(normalizePhoneIL("+972535301669")).toBe("+972535301669");
  });

  it("rejects garbage", () => {
    expect(normalizePhoneIL("123")).toBeNull();
    expect(normalizePhoneIL("")).toBeNull();
  });
});

describe("isValidEmail", () => {
  it("validates basics", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
  });
});
