import { describe, expect, it } from "vitest";

import { sanitizeLessonContent } from "./sanitizeContent.js";

describe("sanitizeLessonContent", () => {
  it("drops a script tag together with its body", () => {
    const content = sanitizeLessonContent(
      "<p>До</p><script>alert(1)</script><p>После</p>",
    );

    expect(content).toBe("<p>До</p><p>После</p>");
    expect(content).not.toContain("alert");
  });

  it("returns an empty string for input that is only a script", () => {
    expect(sanitizeLessonContent("<script>alert(1)</script>")).toBe("");
  });

  it("removes event handler attributes", () => {
    const content = sanitizeLessonContent(
      '<p onclick="steal()">Текст</p><img src="https://example.com/a.png" onerror="steal()">',
    );

    expect(content).not.toContain("onclick");
    expect(content).not.toContain("onerror");
    expect(content).toContain("<p>Текст</p>");
  });

  it("removes a javascript: link but keeps the text", () => {
    const content = sanitizeLessonContent(
      '<a href="javascript:alert(1)">Нажми</a>',
    );

    expect(content).not.toContain("javascript:");
    expect(content).toContain("Нажми");
  });

  it("keeps allowed formatting and marks external links as safe", () => {
    const content = sanitizeLessonContent(
      '<p><strong>Важно</strong></p><ul><li>Пункт</li></ul>' +
        '<a href="https://example.com" title="Пример">Ссылка</a>',
    );

    expect(content).toContain("<strong>Важно</strong>");
    expect(content).toContain("<ul><li>Пункт</li></ul>");
    expect(content).toContain('href="https://example.com"');
    expect(content).toContain('target="_blank"');
    expect(content).toContain('rel="noopener noreferrer nofollow"');
  });
});
