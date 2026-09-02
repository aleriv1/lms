import sanitizeHtml from "sanitize-html";

/**
 * Lesson content is stored as HTML, cleaned on write — the single point where
 * specification 7.6 ("content is displayed safely, without executing arbitrary
 * scripts") is enforced. The list is a whitelist: everything unnamed is dropped,
 * which is what removes event handlers such as `onclick`.
 */
const LESSON_CONTENT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "strong",
    "em",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    // `target` and `rel` are here only so the pair `transformTags` adds below
    // survives: attribute filtering runs after the transform. A value sent by
    // the client cannot get through — `simpleTransform` overwrites both.
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  disallowedTagsMode: "discard",
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      target: "_blank",
      rel: "noopener noreferrer nofollow",
    }),
  },
};

export function sanitizeLessonContent(raw: string): string {
  return sanitizeHtml(raw, LESSON_CONTENT_OPTIONS);
}
