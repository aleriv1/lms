import {
  adminUserListItemSchema,
  type AdminUpdateUserBody,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUsersQuery,
  type Assignment,
  type CourseListItem,
  type CreateAssignmentBody,
  type ListMeta,
  type ListResponse,
} from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import { requestCourses } from "../courses/coursesApi";
import type { LoadStatus } from "../courses/coursesSlice";
import {
  requestAdminUser,
  requestAdminUsers,
  requestAdminUserUpdate,
  requestAssignmentCreate,
  requestAssignmentRevoke,
} from "./usersApi";

type AdminUsersState = {
  list: {
    items: AdminUserListItem[];
    meta: ListMeta;
    status: LoadStatus;
    requestId: string | null;
  };
  detail: {
    user: AdminUserDetail | null;
    status: LoadStatus;
    error: FormError | null;
  };
  assignableCourses: {
    items: CourseListItem[];
    total: number;
    status: LoadStatus;
  };
};

const initialState: AdminUsersState = {
  list: {
    items: [],
    meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    status: "idle",
    requestId: null,
  },
  detail: { user: null, status: "idle", error: null },
  assignableCourses: { items: [], total: 0, status: "idle" },
};

export const fetchAdminUsers = createAsyncThunk<
  ListResponse<AdminUserListItem>,
  AdminUsersQuery,
  { rejectValue: FormError }
>("adminUsers/fetchAdminUsers", async (query, { rejectWithValue }) => {
  try {
    return await requestAdminUsers(query);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const fetchAdminUser = createAsyncThunk<
  AdminUserDetail,
  string,
  { rejectValue: FormError }
>("adminUsers/fetchAdminUser", async (userId, { rejectWithValue }) => {
  try {
    return await requestAdminUser(userId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const updateAdminUser = createAsyncThunk<
  AdminUserDetail,
  { userId: string; body: AdminUpdateUserBody },
  { rejectValue: FormError }
>(
  "adminUsers/updateAdminUser",
  async ({ userId, body }, { rejectWithValue }) => {
    try {
      return await requestAdminUserUpdate(userId, body);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const fetchAssignableCourses = createAsyncThunk<
  ListResponse<CourseListItem>,
  void,
  { rejectValue: FormError }
>(
  "adminUsers/fetchAssignableCourses",
  async (_argument, { rejectWithValue }) => {
    try {
      return await requestCourses({
        status: "published",
        sortBy: "title",
        sortOrder: "asc",
        page: 1,
        pageSize: 50,
      });
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const createAssignment = createAsyncThunk<
  Assignment,
  { userId: string; body: CreateAssignmentBody },
  { rejectValue: FormError }
>(
  "adminUsers/createAssignment",
  async ({ userId, body }, { rejectWithValue }) => {
    try {
      return await requestAssignmentCreate(userId, body);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const revokeAssignment = createAsyncThunk<
  Assignment,
  { userId: string; assignmentId: string },
  { rejectValue: FormError }
>(
  "adminUsers/revokeAssignment",
  async ({ userId, assignmentId }, { rejectWithValue }) => {
    try {
      return await requestAssignmentRevoke(userId, assignmentId);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

const adminUsersSlice = createSlice({
  name: "adminUsers",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminUsers.pending, (state, action) => {
        state.list.status = "loading";
        state.list.requestId = action.meta.requestId;
      })
      .addCase(fetchAdminUsers.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) {
          return;
        }
        state.list.items = action.payload.items;
        state.list.meta = action.payload.meta;
        state.list.status = "ready";
        state.list.requestId = null;
      })
      .addCase(fetchAdminUsers.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) {
          return;
        }
        state.list.status = "error";
        state.list.requestId = null;
      })
      .addCase(fetchAdminUser.pending, (state) => {
        state.detail.user = null;
        state.detail.status = "loading";
        state.detail.error = null;
      })
      .addCase(fetchAdminUser.fulfilled, (state, action) => {
        state.detail.user = action.payload;
        state.detail.status = "ready";
        state.detail.error = null;
      })
      .addCase(fetchAdminUser.rejected, (state, action) => {
        state.detail.user = null;
        state.detail.status = "error";
        state.detail.error = action.payload ?? toFormError(action.error);
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        if (state.detail.user?.id === action.payload.id) {
          state.detail.user = action.payload;
        }
        const index = state.list.items.findIndex(
          (user) => user.id === action.payload.id,
        );
        const row = state.list.items[index];
        if (row) {
          state.list.items[index] = adminUserListItemSchema.parse({
            ...action.payload,
            activeAssignmentsCount: row.activeAssignmentsCount,
          });
        }
      })
      .addCase(fetchAssignableCourses.pending, (state) => {
        state.assignableCourses.status = "loading";
      })
      .addCase(fetchAssignableCourses.fulfilled, (state, action) => {
        state.assignableCourses.items = action.payload.items;
        state.assignableCourses.total = action.payload.meta.total;
        state.assignableCourses.status = "ready";
      })
      .addCase(fetchAssignableCourses.rejected, (state) => {
        state.assignableCourses.status = "error";
      })
      .addCase(createAssignment.fulfilled, (state, action) => {
        const assignment = action.payload;
        if (state.detail.user?.id === assignment.userId) {
          state.detail.user.assignments.unshift(assignment);
        }
        const row = state.list.items.find(
          (user) => user.id === assignment.userId,
        );
        if (row) {
          row.activeAssignmentsCount += 1;
        }
      })
      .addCase(revokeAssignment.fulfilled, (state, action) => {
        const assignment = action.payload;
        if (state.detail.user?.id === assignment.userId) {
          state.detail.user.assignments = state.detail.user.assignments.map(
            (item) => (item.id === assignment.id ? assignment : item),
          );
        }
        const row = state.list.items.find(
          (user) => user.id === assignment.userId,
        );
        if (row) {
          row.activeAssignmentsCount = Math.max(
            0,
            row.activeAssignmentsCount - 1,
          );
        }
      });
  },
});

export const adminUsersReducer = adminUsersSlice.reducer;
