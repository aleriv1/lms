import {
  PAGE_SIZES,
  type CourseListItem,
  type ListResponse,
} from "@lms/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/ApiError";
import { apiRequest } from "../../api/client";
import { store } from "../../store";
import { sessionExpired } from "../auth/authSlice";
import { requestCourses } from "../courses/coursesApi";
import {
  fetchDashboard,
  fetchFilterCourses,
  fetchMyStatistics,
  fetchStatistics,
  fetchUserStatistics,
} from "./statisticsApi";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiRequest: vi.fn(),
}));
vi.mock("../courses/coursesApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../courses/coursesApi")>()),
  requestCourses: vi.fn(),
}));

const dashboard = {
  activeCoursesCount: 2,
  usersCount: 6,
  testsCount: 3,
  activeAssignmentsCount: 1,
  newUsersLast7DaysCount: 4,
  completedCoursesCount: 8,
  averageProgressPercent: 37,
  recentCourses: [],
};
const catalogue = {
  items: [
    {
      id: "bbbbbbbbbbbbbbbbbbbbbbbb",
      title: "Курс",
      category: "Категория",
      audience: "general",
      shortDescription: "Описание курса",
      coverUrl: null,
      author: { id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Автор" },
      status: "published",
      publishedAt: "2026-09-03T10:00:00.000Z",
      lessonsCount: 2,
      createdAt: "2026-09-03T10:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    },
  ],
  meta: { page: 1, pageSize: 50, total: 1, totalPages: 1 },
} satisfies ListResponse<CourseListItem>;

beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(sessionExpired());
});

describe("statistics read thunks", () => {
  it("parses the dashboard and preserves the returned numbers", async () => {
    vi.mocked(apiRequest).mockResolvedValue(dashboard);
    const action = await store.dispatch(fetchDashboard());
    expect(fetchDashboard.fulfilled.match(action)).toBe(true);
    expect(store.getState().statistics.dashboard.data).toEqual(dashboard);
    expect(apiRequest).toHaveBeenCalledWith("/admin/dashboard", {
      signal: expect.any(AbortSignal),
    });
  });

  it("sends only supported query keys and preserves the list envelope", async () => {
    const response = {
      summary: {
        usersCount: 0,
        activeUsersCount: 0,
        completedUsersCount: 0,
        averageProgressPercent: 0,
      },
      items: [],
      courseProgress: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    await store.dispatch(
      fetchStatistics({
        page: 1,
        pageSize: 20,
        courseId: "bbbbbbbbbbbbbbbbbbbbbbbb",
        groupName: "Смена А",
        learningStatus: "completed",
      }),
    );
    const path = vi.mocked(apiRequest).mock.calls[0]?.[0];
    expect(path).toBeDefined();
    const params = new URL(path ?? "", "https://example.test").searchParams;
    expect(params.get("courseId")).toBe("bbbbbbbbbbbbbbbbbbbbbbbb");
    expect(params.get("groupName")).toBe("Смена А");
    expect(params.has("learningStatus")).toBe(false);
    expect(store.getState().statistics.list.data).toEqual(response);
  });

  it.each(["nope", "ffffffffffffffffffffffff"])(
    "retains the same not-found refusal for %s",
    async (id) => {
      vi.mocked(apiRequest).mockRejectedValue(
        new ApiError(404, "not_found", "Страница не найдена"),
      );
      const action = await store.dispatch(fetchUserStatistics(id));
      expect(fetchUserStatistics.rejected.match(action)).toBe(true);
      expect(apiRequest).toHaveBeenCalledWith(`/admin/statistics/users/${id}`, {
        signal: expect.any(AbortSignal),
      });
      expect(store.getState().statistics.userCard.error?.code).toBe(
        "not_found",
      );
    },
  );

  it("parses personal statistics without deriving scores, flags or course sets", async () => {
    const response = {
      totalLearningMinutes: 85,
      completedLessonsCount: 4,
      completedCoursesCount: 2,
      overallProgressPercent: 37,
      courses: [],
      activityWeeks: [],
      recentActivity: [],
      testResults: [
        {
          id: "cccccccccccccccccccccccc",
          testId: "dddddddddddddddddddddddd",
          testTitle: "Тест",
          courseId: "bbbbbbbbbbbbbbbbbbbbbbbb",
          courseTitle: "Курс",
          score: 37,
          passed: true,
          attemptNumber: 4,
          submittedAt: "2026-09-03T10:00:00.000Z",
          isBest: true,
          isLast: true,
        },
      ],
    };
    vi.mocked(apiRequest).mockResolvedValue(response);
    await store.dispatch(fetchMyStatistics());
    expect(apiRequest).toHaveBeenCalledWith("/learning/me/statistics", {
      signal: expect.any(AbortSignal),
    });
    expect(store.getState().statistics.me.data).toEqual(response);
  });

  it("loads catalogue options once, separately from statistics filters", async () => {
    vi.mocked(requestCourses).mockResolvedValue(catalogue);
    await store.dispatch(fetchFilterCourses());
    await store.dispatch(fetchFilterCourses());
    expect(requestCourses).toHaveBeenCalledTimes(1);
    expect(requestCourses).toHaveBeenCalledWith({
      status: "published",
      sortBy: "title",
      sortOrder: "asc",
      page: 1,
      pageSize: PAGE_SIZES[2],
    });
    expect(store.getState().statistics.filterCourses.data).toEqual(catalogue);
  });

  it("can retry a failed catalogue load", async () => {
    vi.mocked(requestCourses).mockRejectedValueOnce(new Error("offline"));
    await store.dispatch(fetchFilterCourses());
    expect(store.getState().statistics.filterCourses.status).toBe("error");
    vi.mocked(requestCourses).mockResolvedValue(catalogue);
    await store.dispatch(fetchFilterCourses());
    expect(store.getState().statistics.filterCourses.status).toBe("ready");
  });

  it("rejects malformed successful responses on all five boundaries", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});
    vi.mocked(requestCourses).mockResolvedValue(
      {} as Awaited<ReturnType<typeof requestCourses>>,
    );
    await store.dispatch(fetchDashboard());
    await store.dispatch(fetchStatistics({ page: 1, pageSize: 10 }));
    await store.dispatch(fetchUserStatistics("aaaaaaaaaaaaaaaaaaaaaaaa"));
    await store.dispatch(fetchMyStatistics());
    await store.dispatch(fetchFilterCourses());
    for (const branch of Object.values(store.getState().statistics)) {
      expect(branch.status).toBe("error");
      expect(branch.error?.code).toBe("internal_error");
      expect(branch.data).toBeNull();
    }
  });
});
