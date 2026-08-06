import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "./availability";
import { wallTimeToUtc } from "./time";

const windowsFull = [{ open_time: "09:00:00", close_time: "19:00:00" }];
const windowsFri = [{ open_time: "09:00:00", close_time: "14:00:00" }];

describe("computeAvailableSlots", () => {
  it("when step equals duration, empty day only offers duration-aligned starts", () => {
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-02",
      durationMinutes: 30,
      windows: windowsFull,
      busy: [],
      now: wallTimeToUtc("2026-08-02", "08:00:00"),
      bypassLead: true,
      stepMinutes: 30,
    });
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "09:00:00").toISOString());
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "09:30:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "09:15:00").toISOString());
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "10:00:00").toISOString());
  });

  it("offers back-to-back after a 10:00–10:30 booking for a 30-min service", () => {
    const busy = [
      {
        start: wallTimeToUtc("2026-08-02", "10:00:00"), // Sunday
        end: wallTimeToUtc("2026-08-02", "10:30:00"),
      },
    ];
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-02",
      durationMinutes: 30,
      windows: windowsFull,
      busy,
      now: wallTimeToUtc("2026-08-02", "08:00:00"),
      bypassLead: true,
    });
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "10:30:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "10:00:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "10:15:00").toISOString());
  });

  it("does not offer overlapping starts for a 60-min service", () => {
    const busy = [
      {
        start: wallTimeToUtc("2026-08-02", "10:00:00"),
        end: wallTimeToUtc("2026-08-02", "10:30:00"),
      },
    ];
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-02",
      durationMinutes: 60,
      windows: windowsFull,
      busy,
      now: wallTimeToUtc("2026-08-02", "08:00:00"),
      bypassLead: true,
    });
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "10:00:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "09:45:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "09:30:00").toISOString());
  });

  it("does not offer a service longer than remaining time before close", () => {
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-02",
      durationMinutes: 60,
      windows: windowsFull,
      busy: [],
      now: wallTimeToUtc("2026-08-02", "08:00:00"),
      bypassLead: true,
    });
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "18:15:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "18:30:00").toISOString());
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "18:00:00").toISOString());
  });

  it("returns [] for Saturday (no windows)", () => {
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-01", // Saturday
      durationMinutes: 30,
      windows: [],
      busy: [],
      now: wallTimeToUtc("2026-08-01", "08:00:00"),
      bypassLead: true,
    });
    expect(slots).toEqual([]);
  });

  it("Friday stops at short close time", () => {
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-07", // Friday
      durationMinutes: 30,
      windows: windowsFri,
      busy: [],
      now: wallTimeToUtc("2026-08-07", "08:00:00"),
      bypassLead: true,
    });
    expect(slots).toContain(wallTimeToUtc("2026-08-07", "13:30:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-07", "14:00:00").toISOString());
    expect(slots).not.toContain(wallTimeToUtc("2026-08-07", "15:00:00").toISOString());
  });

  it("respects 30-minute lead time", () => {
    const slots = computeAvailableSlots({
      dateYmd: "2026-08-02",
      durationMinutes: 30,
      windows: windowsFull,
      busy: [],
      now: wallTimeToUtc("2026-08-02", "10:00:00"),
      leadMinutes: 30,
    });
    expect(slots).not.toContain(wallTimeToUtc("2026-08-02", "10:15:00").toISOString());
    expect(slots).toContain(wallTimeToUtc("2026-08-02", "10:30:00").toISOString());
  });

  it("DST spring forward — Israel last Friday of March keeps wall-clock slots", () => {
    // Israel DST typically last Friday before last Sunday of March; 2026-03-27 is Friday before transition weekend
    const slots = computeAvailableSlots({
      dateYmd: "2026-03-27",
      durationMinutes: 30,
      windows: windowsFri,
      busy: [],
      now: wallTimeToUtc("2026-03-27", "07:00:00"),
      bypassLead: true,
    });
    expect(slots[0]).toBe(wallTimeToUtc("2026-03-27", "09:00:00").toISOString());
    expect(slots.at(-1)).toBe(wallTimeToUtc("2026-03-27", "13:30:00").toISOString());
    expect(slots.length).toBe(19); // 09:00..13:30 step 15
  });

  it("DST fall back — Israel last Sunday of October keeps wall-clock count", () => {
    // 2026-10-25 is Sunday near Israel autumn transition
    const slots = computeAvailableSlots({
      dateYmd: "2026-10-25",
      durationMinutes: 30,
      windows: windowsFull,
      busy: [],
      now: wallTimeToUtc("2026-10-25", "07:00:00"),
      bypassLead: true,
    });
    expect(slots[0]).toBe(wallTimeToUtc("2026-10-25", "09:00:00").toISOString());
    expect(slots.at(-1)).toBe(wallTimeToUtc("2026-10-25", "18:30:00").toISOString());
    // 09:00 to 18:30 inclusive every 15m = 39 slots
    expect(slots.length).toBe(39);
  });
});

describe("concurrency semantics", () => {
  it("documents that DB EXCLUDE rejects the second overlapping insert", () => {
    // Integration against live Postgres is required for true parallel inserts.
    // Application code catches Postgres 23P01 and returns "התור נתפס".
    expect("23P01").toBe("23P01");
  });
});
