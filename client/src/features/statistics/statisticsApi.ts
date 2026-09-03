import {
  adminDashboardSchema,
  adminStatisticsResponseSchema,
  courseListItemSchema,
  createListResponseSchema,
  learnerStatisticsSchema,
  PAGE_SIZES,
  userStatisticsSchema,
  type AdminDashboard,
  type AdminStatisticsQuery,
  type AdminStatisticsResponse,
  type CourseListItem,
  type LearnerStatistics,
  type ListResponse,
  type UserStatistics,
} from "@lms/shared";
import { createAsyncThunk } from "@reduxjs/toolkit";

import { apiRequest } from "../../api/client";
import { toFormError, type FormError } from "../../api/formError";
import type { RootState } from "../../store";
import { requestCourses } from "../courses/coursesApi";
import { toSearchParams } from "./statisticsQueryParams";

export const fetchDashboard = createAsyncThunk<
  AdminDashboard,
  void,
  { rejectValue: FormError }
>(
  "statistics/fetchDashboard",
  async (_argument, { rejectWithValue, signal }) => {
    try {
      return adminDashboardSchema.parse(
        await apiRequest("/admin/dashboard", { signal }),
      );
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const fetchStatistics = createAsyncThunk<
  AdminStatisticsResponse,
  AdminStatisticsQuery,
  { rejectValue: FormError }
>("statistics/fetchStatistics", async (query, { rejectWithValue, signal }) => {
  try {
    return adminStatisticsResponseSchema.parse(
      await apiRequest(`/admin/statistics?${toSearchParams(query)}`, {
        signal,
      }),
    );
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const fetchUserStatistics = createAsyncThunk<
  UserStatistics,
  string,
  { rejectValue: FormError }
>(
  "statistics/fetchUserStatistics",
  async (userId, { rejectWithValue, signal }) => {
    try {
      return userStatisticsSchema.parse(
        await apiRequest(
          `/admin/statistics/users/${encodeURIComponent(userId)}`,
          { signal },
        ),
      );
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const fetchMyStatistics = createAsyncThunk<
  LearnerStatistics,
  void,
  { rejectValue: FormError }
>(
  "statistics/fetchMyStatistics",
  async (_argument, { rejectWithValue, signal }) => {
    try {
      return learnerStatisticsSchema.parse(
        await apiRequest("/learning/me/statistics", { signal }),
      );
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const fetchFilterCourses = createAsyncThunk<
  ListResponse<CourseListItem>,
  void,
  { rejectValue: FormError; state: RootState }
>(
  "statistics/fetchFilterCourses",
  async (_argument, { rejectWithValue }) => {
    try {
      return createListResponseSchema(courseListItemSchema).parse(
        await requestCourses({
          status: "published",
          sortBy: "title",
          sortOrder: "asc",
          page: 1,
          pageSize: PAGE_SIZES[2],
        }),
      );
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
  {
    condition: (_argument, { getState }) => {
      const status = getState().statistics.filterCourses.status;
      return status !== "loading" && status !== "ready";
    },
  },
);
