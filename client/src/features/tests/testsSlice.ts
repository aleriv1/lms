import type { CreateTestBody, Test, UpdateTestBody } from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import type { LoadStatus } from "../courses/coursesSlice";
import {
  requestTest,
  requestTestCreate,
  requestTestDelete,
  requestTestUpdate,
} from "./testsApi";

export type TestsState = {
  detail: {
    test: Test | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

const initialState: TestsState = {
  detail: { test: null, status: "idle", error: null },
};

export const fetchTest = createAsyncThunk<
  Test,
  string,
  { rejectValue: FormError }
>("tests/fetchTest", async (testId, { rejectWithValue }) => {
  try {
    return await requestTest(testId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const createTest = createAsyncThunk<
  Test,
  { courseId: string; body: CreateTestBody },
  { rejectValue: FormError }
>("tests/createTest", async ({ courseId, body }, { rejectWithValue }) => {
  try {
    return await requestTestCreate(courseId, body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const updateTest = createAsyncThunk<
  Test,
  { courseId: string; testId: string; body: UpdateTestBody },
  { rejectValue: FormError }
>(
  "tests/updateTest",
  async ({ courseId, testId, body }, { rejectWithValue }) => {
    try {
      return await requestTestUpdate(courseId, testId, body);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const deleteTest = createAsyncThunk<
  { courseId: string; testId: string },
  { courseId: string; testId: string },
  { rejectValue: FormError }
>("tests/deleteTest", async ({ courseId, testId }, { rejectWithValue }) => {
  try {
    await requestTestDelete(courseId, testId);
    return { courseId, testId };
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

const testsSlice = createSlice({
  name: "tests",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTest.pending, (state) => {
        state.detail.test = null;
        state.detail.status = "loading";
        state.detail.error = null;
      })
      .addCase(fetchTest.fulfilled, (state, action) => {
        state.detail.test = action.payload;
        state.detail.status = "ready";
        state.detail.error = null;
      })
      .addCase(fetchTest.rejected, (state, action) => {
        state.detail.test = null;
        state.detail.status = "error";
        state.detail.error = action.payload ?? toFormError(action.error);
      })
      .addCase(updateTest.fulfilled, (state, action) => {
        state.detail.test = action.payload;
      });
  },
});

export const testsReducer = testsSlice.reducer;
