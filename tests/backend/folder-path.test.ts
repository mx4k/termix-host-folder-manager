import { describe, expect, it } from "vitest";
import {
  folderAncestors,
  isFolderInside,
  normalizeFolderPath,
  replaceFolderPrefix,
  validFolderName,
  validFolderPath,
} from "../../src/shared/folder-path.js";

describe("folder path helpers", () => {
  it("normalizes slash-delimited legacy paths and lists ancestors", () => {
    expect(normalizeFolderPath(" Production/Web / API ")).toBe(
      "Production / Web / API",
    );
    expect(folderAncestors("Production/Web/API")).toEqual([
      "Production",
      "Production / Web",
      "Production / Web / API",
    ]);
  });

  it("matches folder descendants without prefix collisions", () => {
    expect(isFolderInside("Prod / Web", "Prod")).toBe(true);
    expect(isFolderInside("Production", "Prod")).toBe(false);
  });

  it("replaces a folder prefix and preserves descendant paths", () => {
    expect(replaceFolderPrefix("Prod / Web / API", "Prod", "Apps")).toBe(
      "Apps / Web / API",
    );
  });

  it("only accepts a single safe folder name", () => {
    expect(validFolderName("Web servers")).toBe(true);
    expect(validFolderName("Prod/Web")).toBe(false);
    expect(validFolderName("  ")).toBe(false);
    expect(validFolderName("..")).toBe(false);
  });

  it("accepts only safe non-empty folder paths", () => {
    expect(validFolderPath("Production / Web")).toBe(true);
    expect(validFolderPath(" / ")).toBe(false);
    expect(validFolderPath("Production / ../Web")).toBe(false);
  });
});
