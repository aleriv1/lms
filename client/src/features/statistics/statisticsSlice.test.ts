import {
  adminDashboardSchema,
  adminStatisticsResponseSchema,
  learnerStatisticsSchema,
  userStatisticsSchema,
} from "@lms/shared";
import { describe, expect, it } from "vitest";

import { login, logout, sessionExpired } from "../auth/authSlice";
import {
  fetchDashboard,
  fetchFilterCourses,
  fetchMyStatistics,
  fetchStatistics,
  fetchUserStatistics,
} from "./statisticsApi";
import { statisticsReducer } from "./statisticsSlice";

const query = { page: 1, pageSize: 10 };
const dashboard = adminDashboardSchema.parse({
  activeCoursesCount: 2,
  usersCount: 6,
  testsCount: 3,
  activeAssignmentsCount: 1,
  newUsersLast7DaysCount: 4,
  completedCoursesCount: 8,
  averageProgressPercent: 37,
  recentCourses: [],
});
const list = adminStatisticsResponseSchema.parse({
  summary: {
    usersCount: 6,
    activeUsersCount: 1,
    completedUsersCount: 1,
    averageProgressPercent: 100,
  },
  items: [],
  courseProgress: [],
  meta: { ...query, total: 6, totalPages: 1 },
});
const me = learnerStatisticsSchema.parse({
  totalLearningMinutes: 85,
  completedLessonsCount: 4,
  completedCoursesCount: 2,
  overallProgressPercent: 37,
  courses: [],
  testResults: [],
  activityWeeks: [],
  recentActivity: [],
});
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const user = userStatisticsSchema.parse({
  user: {
    id: userId,
    name: "Ученик",
    email: "student@example.com",
    role: "student",
    status: "active",
    groupName: null,
    createdAt: "2026-09-03T10:00:00.000Z",
    updatedAt: "2026-09-03T10:00:00.000Z",
    lastLoginAt: null,
  },
  averageProgressPercent: 37,
  completedCoursesCount: 2,
  totalLearningMinutes: 85,
  courses: [],
  testResults: [],
  recentActivity: [],
});

describe("independent statistics branches", () => {
  it("keeps server responses intact and isolates list failures from the dashboard", () => {
    let state = statisticsReducer(
      undefined,
      fetchDashboard.pending("dashboard", undefined),
    );
    state = statisticsReducer(
      state,
      fetchDashboard.fulfilled(dashboard, "dashboard", undefined),
    );
    state = statisticsReducer(state, fetchStatistics.pending("list", query));
    state = statisticsReducer(
      state,
      fetchStatistics.rejected(null, "list", query, {
        code: "internal_error",
        message: "Ошибка",
      }),
    );
    expect(state.dashboard.data).toEqual(dashboard);
    expect(state.dashboard.status).toBe("ready");
    expect(state.list.status).toBe("error");
    expect(state.list.error?.message).toBe("Ошибка");
    expect(state.me.status).toBe("idle");
  });

  it("ignores old list successes and failures after a filter change", () => {
    let state = statisticsReducer(
      undefined,
      fetchStatistics.pending("old", query),
    );
    state = statisticsReducer(
      state,
      fetchStatistics.pending("new", { ...query, groupName: "А" }),
    );
    expect(
      statisticsReducer(state, fetchStatistics.fulfilled(list, "old", query)),
    ).toEqual(state);
    expect(
      statisticsReducer(state, fetchStatistics.rejected(null, "old", query)),
    ).toEqual(state);
    expect(
      statisticsReducer(
        state,
        fetchStatistics.fulfilled(list, "new", { ...query, groupName: "А" }),
      ).list.data,
    ).toEqual(list);
  });

  it("keeps catalogue options independent from a filtered empty list", () => {
    const catalogue = {
      items: [],
      meta: { page: 1, pageSize: 50, total: 0, totalPages: 0 },
    };
    let state = statisticsReducer(
      undefined,
      fetchFilterCourses.pending("courses", undefined),
    );
    state = statisticsReducer(
      state,
      fetchFilterCourses.fulfilled(catalogue, "courses", undefined),
    );
    state = statisticsReducer(state, fetchStatistics.pending("list", query));
    state = statisticsReducer(
      state,
      fetchStatistics.fulfilled(list, "list", query),
    );
    expect(state.filterCourses.data).toEqual(catalogue);
    expect(state.filterCourses.status).toBe("ready");
  });

  it("stores a case-insensitive card identity and refuses stale card responses", () => {
    let state = statisticsReducer(
      undefined,
      fetchUserStatistics.pending("old", "bbbbbbbbbbbbbbbbbbbbbbbb"),
    );
    state = statisticsReducer(
      state,
      fetchUserStatistics.pending("new", userId.toUpperCase()),
    );
    expect(
      statisticsReducer(
        state,
        fetchUserStatistics.fulfilled(user, "old", userId),
      ),
    ).toEqual(state);
    state = statisticsReducer(
      state,
      fetchUserStatistics.fulfilled(user, "new", userId.toUpperCase()),
    );
    expect(state.userCard.data).toEqual(user);
    expect(state.userCard.userId?.toLowerCase()).toBe(user.user.id);
  });

  it.each(["nope", "ffffffffffffffffffffffff"])(
    "keeps the same not-found code for %s",
    (id) => {
      const state = statisticsReducer(
        undefined,
        fetchUserStatistics.pending("card", id),
      );
      const result = statisticsReducer(
        state,
        fetchUserStatistics.rejected(null, "card", id, {
          code: "not_found",
          message: "Страница не найдена",
        }),
      );
      expect(result.userCard.status).toBe("error");
      expect(result.userCard.data).toBeNull();
      expect(result.userCard.error?.code).toBe("not_found");
    },
  );

  it("stores personal statistics without recomputing them", () => {
    const state = statisticsReducer(
      undefined,
      fetchMyStatistics.pending("me", undefined),
    );
    expect(
      statisticsReducer(state, fetchMyStatistics.fulfilled(me, "me", undefined))
        .me.data,
    ).toEqual(me);
  });

  it("clears session data and ignores responses still arriving after reset", () => {
    let state = statisticsReducer(
      undefined,
      fetchDashboard.pending("dashboard", undefined),
    );
    state = statisticsReducer(
      state,
      fetchDashboard.fulfilled(dashboard, "dashboard", undefined),
    );
    state = statisticsReducer(
      state,
      fetchMyStatistics.pending("me", undefined),
    );
    const initial = statisticsReducer(undefined, { type: "init" });
    for (const action of [
      sessionExpired(),
      login.pending("login", {
        email: "student@example.com",
        password: "Password1",
      }),
      logout.fulfilled(undefined, "logout", undefined),
      logout.rejected(null, "logout", undefined),
    ]) {
      const reset = statisticsReducer(state, action);
      expect(reset).toEqual(initial);
      expect(
        statisticsReducer(
          reset,
          fetchMyStatistics.fulfilled(me, "me", undefined),
        ),
      ).toEqual(initial);
    }
  });

  it("returns an aborted read to idle without showing an error", () => {
    const state = statisticsReducer(
      undefined,
      fetchMyStatistics.pending("me", undefined),
    );
    const result = statisticsReducer(
      state,
      fetchMyStatistics.rejected(
        { name: "AbortError", message: "Aborted" },
        "me",
        undefined,
      ),
    );
    expect(result.me.status).toBe("idle");
    expect(result.me.error).toBeNull();
  });
});
