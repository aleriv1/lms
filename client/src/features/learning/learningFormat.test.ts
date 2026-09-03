import { expect, it } from "vitest";

import { formatMinutes } from "./learningFormat";

it.each([
  [0, "0 мин"],
  [45, "45 мин"],
  [60, "1 ч"],
  [150, "2 ч 30 мин"],
  [1445, "24 ч 5 мин"],
])("formats %i learning minutes as %s", (minutes, expected) => {
  expect(formatMinutes(minutes)).toBe(expected);
});
