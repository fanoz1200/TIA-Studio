import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const kitPath = resolve(import.meta.dirname, "tia-windows-desktop-blueprint.json");

describe("TIA Windows desktop blueprint", () => {
  it("is valid, reusable JSON with the critical production boundary", () => {
    const kit = JSON.parse(readFileSync(kitPath, "utf8")) as {
      kitVersion: string;
      principles: string[];
      referenceArchitecture: { productionBoundary: { required: string[] } };
      releaseWorkflow: Array<{ name: string }>;
      acceptanceCriteria: string[];
    };

    expect(kit.kitVersion).toBe("1.0.0");
    expect(kit.principles.some(principle => principle.includes("Local-first"))).toBe(true);
    expect(kit.referenceArchitecture.productionBoundary.required).toContain(
      "Keep Vite and vite.config imports out of the production bundle.",
    );
    expect(kit.releaseWorkflow.map(step => step.name)).toContain("Smoke test");
    expect(kit.acceptanceCriteria.some(criterion => criterion.includes("real Windows device"))).toBe(true);
  });

  it("does not carry obvious secret placeholders or customer source data", () => {
    const rawKit = readFileSync(kitPath, "utf8");
    expect(rawKit).not.toMatch(/(?:sk|pk)_[a-z0-9]{20,}|ghp_[a-z0-9]{20,}|api[_-]?key\s*[:=]\s*["'][^"']+/i);
    expect(rawKit).not.toMatch(/password\s*[:=]\s*["'][^"']+|database_url\s*[:=]\s*["'][^"']+/i);
    expect(rawKit).not.toMatch(/\.xer|\.xlsx/i);
  });
});
