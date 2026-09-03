import type {
  AdminDashboard,
  AdminStatisticsResponse,
  CourseListItem,
  LearnerStatistics,
  ListResponse,
  UserStatistics,
} from "@lms/shared";
import { createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import { login, logout, sessionExpired } from "../auth/authSlice";
import type { LoadStatus } from "../courses/coursesSlice";
import {
  fetchDashboard,
  fetchStatistics,
  fetchUserStatistics,
  fetchMyStatistics,
  fetchFilterCourses,
} from "./statisticsApi";

type StatisticsState = {
  dashboard: {
    data: AdminDashboard | null;
    status: LoadStatus;
    error: FormError | null;
    requestId: string | null;
  };
  list: {
    data: AdminStatisticsResponse | null;
    status: LoadStatus;
    error: FormError | null;
    requestId: string | null;
  };
  userCard: {
    data: UserStatistics | null;
    status: LoadStatus;
    error: FormError | null;
    requestId: string | null;
    userId: string | null;
  };
  me: {
    data: LearnerStatistics | null;
    status: LoadStatus;
    error: FormError | null;
    requestId: string | null;
  };
  filterCourses: {
    data: ListResponse<CourseListItem> | null;
    status: LoadStatus;
    error: FormError | null;
    requestId: string | null;
  };
};

const initialState: StatisticsState = {
  dashboard: { data: null, status: "idle", error: null, requestId: null },
  list: { data: null, status: "idle", error: null, requestId: null },
  userCard: {
    data: null,
    status: "idle",
    error: null,
    requestId: null,
    userId: null,
  },
  me: { data: null, status: "idle", error: null, requestId: null },
  filterCourses: { data: null, status: "idle", error: null, requestId: null },
};

const statisticsSlice = createSlice({
  name: "statistics",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionExpired, () => initialState)
      .addCase(login.pending, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState)
      .addCase(fetchDashboard.pending, (state, action) => {
        state.dashboard.data = null;
        state.dashboard.status = "loading";
        state.dashboard.error = null;
        state.dashboard.requestId = action.meta.requestId;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        if (state.dashboard.requestId !== action.meta.requestId) return;
        state.dashboard.data = action.payload;
        state.dashboard.status = "ready";
        state.dashboard.requestId = null;
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        if (state.dashboard.requestId !== action.meta.requestId) return;
        state.dashboard.status = action.meta.aborted ? "idle" : "error";
        state.dashboard.error = action.meta.aborted
          ? null
          : (action.payload ?? toFormError(action.error));
        state.dashboard.requestId = null;
      })
      .addCase(fetchStatistics.pending, (state, action) => {
        state.list.data = null;
        state.list.status = "loading";
        state.list.error = null;
        state.list.requestId = action.meta.requestId;
      })
      .addCase(fetchStatistics.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        state.list.data = action.payload;
        state.list.status = "ready";
        state.list.requestId = null;
      })
      .addCase(fetchStatistics.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) return;
        state.list.status = action.meta.aborted ? "idle" : "error";
        state.list.error = action.meta.aborted
          ? null
          : (action.payload ?? toFormError(action.error));
        state.list.requestId = null;
      })
      .addCase(fetchUserStatistics.pending, (state, action) => {
        state.userCard.data = null;
        state.userCard.status = "loading";
        state.userCard.error = null;
        state.userCard.requestId = action.meta.requestId;
        state.userCard.userId = action.meta.arg;
      })
      .addCase(fetchUserStatistics.fulfilled, (state, action) => {
        if (state.userCard.requestId !== action.meta.requestId) return;
        state.userCard.data = action.payload;
        state.userCard.status = "ready";
        state.userCard.requestId = null;
      })
      .addCase(fetchUserStatistics.rejected, (state, action) => {
        if (state.userCard.requestId !== action.meta.requestId) return;
        state.userCard.status = action.meta.aborted ? "idle" : "error";
        state.userCard.error = action.meta.aborted
          ? null
          : (action.payload ?? toFormError(action.error));
        state.userCard.requestId = null;
      })
      .addCase(fetchMyStatistics.pending, (state, action) => {
        state.me.data = null;
        state.me.status = "loading";
        state.me.error = null;
        state.me.requestId = action.meta.requestId;
      })
      .addCase(fetchMyStatistics.fulfilled, (state, action) => {
        if (state.me.requestId !== action.meta.requestId) return;
        state.me.data = action.payload;
        state.me.status = "ready";
        state.me.requestId = null;
      })
      .addCase(fetchMyStatistics.rejected, (state, action) => {
        if (state.me.requestId !== action.meta.requestId) return;
        state.me.status = action.meta.aborted ? "idle" : "error";
        state.me.error = action.meta.aborted
          ? null
          : (action.payload ?? toFormError(action.error));
        state.me.requestId = null;
      })
      .addCase(fetchFilterCourses.pending, (state, action) => {
        state.filterCourses.data = null;
        state.filterCourses.status = "loading";
        state.filterCourses.error = null;
        state.filterCourses.requestId = action.meta.requestId;
      })
      .addCase(fetchFilterCourses.fulfilled, (state, action) => {
        if (state.filterCourses.requestId !== action.meta.requestId) return;
        state.filterCourses.data = action.payload;
        state.filterCourses.status = "ready";
        state.filterCourses.requestId = null;
      })
      .addCase(fetchFilterCourses.rejected, (state, action) => {
        if (state.filterCourses.requestId !== action.meta.requestId) return;
        state.filterCourses.status = action.meta.aborted ? "idle" : "error";
        state.filterCourses.error = action.meta.aborted
          ? null
          : (action.payload ?? toFormError(action.error));
        state.filterCourses.requestId = null;
      });
  },
});

export const statisticsReducer = statisticsSlice.reducer;
