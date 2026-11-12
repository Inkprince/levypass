import { describe, expect, it } from "vitest";
import { parseStaffIdInput, staffIdKey, staffNumberKey } from "./staff-id";

describe("parseStaffIdInput", () => {
  it("reads a full staff ID however it was typed on a keypad", () => {
    for (const typed of ["OTT-001", "ott-001", "OTT001", "ott 001", " Ott.001 "]) {
      expect(parseStaffIdInput(typed)).toEqual({ kind: "full", key: "OTT001", shown: typed.trim().toUpperCase() });
    }
  });

  it("reads digits alone as the staff number, ignoring leading zeros", () => {
    expect(parseStaffIdInput("001")).toEqual({ kind: "number", number: "1", shown: "001" });
    expect(parseStaffIdInput("1")).toEqual({ kind: "number", number: "1", shown: "1" });
    expect(parseStaffIdInput("010")).toEqual({ kind: "number", number: "10", shown: "010" });
    expect(parseStaffIdInput("000")).toEqual({ kind: "number", number: "0", shown: "000" });
  });

  it("returns null when nothing usable was typed", () => {
    expect(parseStaffIdInput("")).toBeNull();
    expect(parseStaffIdInput("  ")).toBeNull();
    expect(parseStaffIdInput("--")).toBeNull();
  });
});

describe("keys for stored staff IDs", () => {
  it("normalise the same way as the input", () => {
    expect(staffIdKey("OTT-001")).toBe("OTT001");
    expect(staffNumberKey("OTT-001")).toBe("1");
    expect(staffNumberKey("OTT-000")).toBe("0");
    expect(staffNumberKey("OTT")).toBeNull();
  });
});
