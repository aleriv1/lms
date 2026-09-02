import type {
  CourseDetail,
  CreateLessonBody,
  Lesson,
  ReorderLessonsBody,
  UpdateLessonBody,
} from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import type { LoadStatus } from "../courses/coursesSlice";
import {
  requestLesson,
  requestLessonCreate,
  requestLessonDelete,
  requestLessonPublish,
  requestLessonsReorder,
  requestLessonUnpublish,
  requestLessonUpdate,
} from "./lessonsApi";

export type LessonsState = {
  detail: {
    lesson: Lesson | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

const initialState: LessonsState = {
  detail: {
    lesson: null,
    status: "idle",
    error: null,
  },
};

export const fetchLesson = createAsyncThunk<
  Lesson,
  string,
  { rejectValue: FormError }
>("lessons/fetchLesson", async (lessonId, { rejectWithValue }) => {
  try {
    return await requestLesson(lessonId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const createLesson = createAsyncThunk<
  Lesson,
  { courseId: string; body: CreateLessonBody },
  { rejectValue: FormError }
>("lessons/createLesson", async ({ courseId, body }, { rejectWithValue }) => {
  try {
    return await requestLessonCreate(courseId, body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const updateLesson = createAsyncThunk<
  Lesson,
  { courseId: string; lessonId: string; body: UpdateLessonBody },
  { rejectValue: FormError }
>(
  "lessons/updateLesson",
  async ({ courseId, lessonId, body }, { rejectWithValue }) => {
    try {
      return await requestLessonUpdate(courseId, lessonId, body);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const deleteLesson = createAsyncThunk<
  { courseId: string; lessonId: string },
  { courseId: string; lessonId: string },
  { rejectValue: FormError }
>(
  "lessons/deleteLesson",
  async ({ courseId, lessonId }, { rejectWithValue }) => {
    try {
      await requestLessonDelete(courseId, lessonId);
      return { courseId, lessonId };
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const publishLesson = createAsyncThunk<
  Lesson,
  { courseId: string; lessonId: string },
  { rejectValue: FormError }
>(
  "lessons/publishLesson",
  async ({ courseId, lessonId }, { rejectWithValue }) => {
    try {
      return await requestLessonPublish(courseId, lessonId);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const unpublishLesson = createAsyncThunk<
  Lesson,
  { courseId: string; lessonId: string },
  { rejectValue: FormError }
>(
  "lessons/unpublishLesson",
  async ({ courseId, lessonId }, { rejectWithValue }) => {
    try {
      return await requestLessonUnpublish(courseId, lessonId);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const reorderLessons = createAsyncThunk<
  CourseDetail,
  { courseId: string; body: ReorderLessonsBody },
  { rejectValue: FormError }
>("lessons/reorderLessons", async ({ courseId, body }, { rejectWithValue }) => {
  try {
    return await requestLessonsReorder(courseId, body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

const lessonsSlice = createSlice({
  name: "lessons",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLesson.pending, (state) => {
        state.detail.lesson = null;
        state.detail.status = "loading";
        state.detail.error = null;
      })
      .addCase(fetchLesson.fulfilled, (state, action) => {
        state.detail.lesson = action.payload;
        state.detail.status = "ready";
        state.detail.error = null;
      })
      .addCase(fetchLesson.rejected, (state, action) => {
        state.detail.lesson = null;
        state.detail.status = "error";
        state.detail.error = action.payload ?? toFormError(action.error);
      })
      .addCase(updateLesson.fulfilled, (state, action) => {
        state.detail.lesson = action.payload;
      });
  },
});

export const lessonsReducer = lessonsSlice.reducer;
