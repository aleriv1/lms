import type {
  LearningCourse,
  LearningLesson,
  LearningOverview,
  LessonProgressResponse,
} from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import { logout, sessionExpired } from "../auth/authSlice";
import type { LoadStatus } from "../courses/coursesSlice";
import {
  requestLearningCourse,
  requestLearningLesson,
  requestLearningOverview,
  requestLessonComplete,
  requestLessonStart,
} from "./learningApi";

export type LearningState = {
  overview: {
    data: LearningOverview | null;
    status: LoadStatus;
    error: FormError | null;
  };
  course: {
    data: LearningCourse | null;
    status: LoadStatus;
    error: FormError | null;
  };
  lesson: {
    data: LearningLesson | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

const initialState: LearningState = {
  overview: { data: null, status: "idle", error: null },
  course: { data: null, status: "idle", error: null },
  lesson: { data: null, status: "idle", error: null },
};

export const fetchLearningOverview = createAsyncThunk<
  LearningOverview,
  void,
  { rejectValue: FormError }
>("learning/fetchOverview", async (_argument, { rejectWithValue }) => {
  try {
    return await requestLearningOverview();
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const fetchLearningCourse = createAsyncThunk<
  LearningCourse,
  string,
  { rejectValue: FormError }
>("learning/fetchCourse", async (courseId, { rejectWithValue }) => {
  try {
    return await requestLearningCourse(courseId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const fetchLearningLesson = createAsyncThunk<
  LearningLesson,
  { courseId: string; lessonId: string },
  { rejectValue: FormError }
>(
  "learning/fetchLesson",
  async ({ courseId, lessonId }, { rejectWithValue }) => {
    try {
      return await requestLearningLesson(courseId, lessonId);
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const startLesson = createAsyncThunk<
  LessonProgressResponse,
  string,
  { rejectValue: FormError }
>("learning/startLesson", async (lessonId, { rejectWithValue }) => {
  try {
    return await requestLessonStart(lessonId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const completeLesson = createAsyncThunk<
  LessonProgressResponse,
  string,
  { rejectValue: FormError }
>("learning/completeLesson", async (lessonId, { rejectWithValue }) => {
  try {
    return await requestLessonComplete(lessonId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

function applyLessonProgress(
  state: LearningState,
  progress: LessonProgressResponse,
): void {
  const course = state.course.data;
  const lesson = state.lesson.data;
  if (course?.id.toLowerCase() === progress.courseId.toLowerCase()) {
    course.progressPercent = progress.courseProgressPercent;
    course.nextLessonId = progress.nextLessonId;
  }
  if (lesson?.courseId.toLowerCase() === progress.courseId.toLowerCase()) {
    lesson.courseProgressPercent = progress.courseProgressPercent;
    if (lesson.id.toLowerCase() === progress.lessonId.toLowerCase()) {
      lesson.progressStatus = progress.status;
    }
    // The action's nextLessonId belongs to the course, not to lesson neighbours.
  }
}

const learningSlice = createSlice({
  name: "learning",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sessionExpired, () => initialState)
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState)
      .addCase(fetchLearningOverview.pending, (state) => {
        state.overview.status = "loading";
        state.overview.error = null;
      })
      .addCase(fetchLearningOverview.fulfilled, (state, action) => {
        state.overview.data = action.payload;
        state.overview.status = "ready";
        state.overview.error = null;
      })
      .addCase(fetchLearningOverview.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.overview.status = "error";
        state.overview.error = action.payload ?? toFormError(action.error);
      })
      .addCase(fetchLearningCourse.pending, (state, action) => {
        if (
          state.course.data?.id.toLowerCase() !== action.meta.arg.toLowerCase()
        ) {
          state.course.data = null;
        }
        state.course.status = "loading";
        state.course.error = null;
      })
      .addCase(fetchLearningCourse.fulfilled, (state, action) => {
        state.course.data = action.payload;
        state.course.status = "ready";
        state.course.error = null;
      })
      .addCase(fetchLearningCourse.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.course.status = "error";
        state.course.error = action.payload ?? toFormError(action.error);
      })
      .addCase(fetchLearningLesson.pending, (state, action) => {
        const { courseId, lessonId } = action.meta.arg;
        if (
          state.lesson.data?.id.toLowerCase() !== lessonId.toLowerCase() ||
          state.lesson.data?.courseId.toLowerCase() !== courseId.toLowerCase()
        ) {
          state.lesson.data = null;
        }
        state.lesson.status = "loading";
        state.lesson.error = null;
      })
      .addCase(fetchLearningLesson.fulfilled, (state, action) => {
        state.lesson.data = action.payload;
        state.lesson.status = "ready";
        state.lesson.error = null;
      })
      .addCase(fetchLearningLesson.rejected, (state, action) => {
        if (action.meta.aborted) return;
        state.lesson.status = "error";
        state.lesson.error = action.payload ?? toFormError(action.error);
      })
      .addCase(startLesson.fulfilled, (state, action) => {
        applyLessonProgress(state, action.payload);
      })
      .addCase(completeLesson.fulfilled, (state, action) => {
        applyLessonProgress(state, action.payload);
      });
  },
});

export const learningReducer = learningSlice.reducer;
