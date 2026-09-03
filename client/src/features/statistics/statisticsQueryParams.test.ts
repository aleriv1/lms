import {
  adminStatisticsQuerySchema,
  GROUP_NAME_MAX_LENGTH,
  PAGE_SIZES,
} from "@lms/shared";
import { describe, expect, it } from "vitest";

import { formatStatisticsProgress } from "./statisticsFormat";
import { readStatisticsQuery, toSearchParams } from "./statisticsQueryParams";

describe("statistics URL query", () => {
  it("uses the shared defaults and strips unsupported controls", () => {
    const query = readStatisticsQuery(
      new URLSearchParams("learningStatus=completed&sortBy=name"),
    );
    expect(query).toEqual(adminStatisticsQuerySchema.parse({}));
    expect(
      toSearchParams({ ...query, learningStatus: "completed" }).has(
        "learningStatus",
      ),
    ).toBe(false);
  });

  it.each(PAGE_SIZES)(
    "round-trips both filters and page size %s",
    (pageSize) => {
      const query = adminStatisticsQuerySchema.parse({
        page: 2,
        pageSize,
        courseId: "ABCDEFABCDEFABCDEFABCDEF",
        groupName: "  Смена А  ",
      });
      expect(readStatisticsQuery(toSearchParams(query))).toEqual(query);
      expect(query.groupName).toBe("Смена А");
    },
  );

  it.each([
    "pageSize=11",
    "pageSize=nope",
    "page=0",
    "page=1.5",
    "courseId=nope",
    `groupName=${"x".repeat(GROUP_NAME_MAX_LENGTH + 1)}`,
  ])("falls back for invalid hand-typed URL: %s", (search) => {
    expect(readStatisticsQuery(new URLSearchParams(search))).toEqual(
      adminStatisticsQuerySchema.parse({}),
    );
  });

  it("omits cleared filters", () => {
    expect(
      toSearchParams({
        page: 1,
        pageSize: 10,
        groupName: "",
        courseId: undefined,
      }).toString(),
    ).toBe("page=1&pageSize=10");
  });
});

describe("statistics progress display", () => {
  const row = {
    userId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    name: "Пользователь",
    groupName: null,
    activeCoursesCount: 0,
    completedCoursesCount: 0,
    averageProgressPercent: 0,
  };

  it("shows a dash only for accounts without assignments", () => {
    expect(formatStatisticsProgress(row)).toBe("—");
    expect(
      formatStatisticsProgress({ ...row, averageProgressPercent: 99 }),
    ).toBe("—");
    expect(formatStatisticsProgress({ ...row, activeCoursesCount: 1 })).toBe(
      "0 %",
    );
    expect(formatStatisticsProgress({ ...row, completedCoursesCount: 1 })).toBe(
      "0 %",
    );
  });

  it("displays the server percentage unchanged", () => {
    expect(
      formatStatisticsProgress({
        ...row,
        activeCoursesCount: 2,
        averageProgressPercent: 37,
      }),
    ).toBe("37 %");
  });
});
