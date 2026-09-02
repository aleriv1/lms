import {
  courseListItemSchema,
  lessonSummarySchema,
  type Course,
  type CourseDetail,
  type CourseListItem,
  type CoursesQuery,
  type CreateCourseBody,
  type ListMeta,
  type UpdateCourseBody,
} from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { toFormError, type FormError } from "../../api/formError";
import { sortLessons } from "../lessons/lessonOrdering";
import {
  createLesson,
  deleteLesson,
  publishLesson,
  reorderLessons,
  unpublishLesson,
  updateLesson,
} from "../lessons/lessonsSlice";
import {
  requestCourse,
  requestCourseArchive,
  requestCourseCreate,
  requestCourseDelete,
  requestCoursePublish,
  requestCourses,
  requestCourseUpdate,
} from "./coursesApi";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export type CoursesState = {
  list: {
    items: CourseListItem[];
    meta: ListMeta;
    status: LoadStatus;
    requestId: string | null;
  };
  detail: {
    course: CourseDetail | null;
    status: LoadStatus;
    error: FormError | null;
  };
};

const initialState: CoursesState = {
  list: {
    items: [],
    meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    status: "idle",
    requestId: null,
  },
  detail: {
    course: null,
    status: "idle",
    error: null,
  },
};

export const fetchCourses = createAsyncThunk<
  { items: CourseListItem[]; meta: ListMeta },
  CoursesQuery,
  { rejectValue: FormError }
>("courses/fetchCourses", async (query, { rejectWithValue }) => {
  try {
    return await requestCourses(query);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const fetchCourse = createAsyncThunk<
  CourseDetail,
  string,
  { rejectValue: FormError }
>("courses/fetchCourse", async (courseId, { rejectWithValue }) => {
  try {
    return await requestCourse(courseId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const createCourse = createAsyncThunk<
  Course,
  CreateCourseBody,
  { rejectValue: FormError }
>("courses/createCourse", async (body, { rejectWithValue }) => {
  try {
    return await requestCourseCreate(body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const updateCourse = createAsyncThunk<
  Course,
  { courseId: string; body: UpdateCourseBody },
  { rejectValue: FormError }
>("courses/updateCourse", async ({ courseId, body }, { rejectWithValue }) => {
  try {
    return await requestCourseUpdate(courseId, body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const deleteCourse = createAsyncThunk<
  string,
  string,
  { rejectValue: FormError }
>("courses/deleteCourse", async (courseId, { rejectWithValue }) => {
  try {
    await requestCourseDelete(courseId);
    return courseId;
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const publishCourse = createAsyncThunk<
  Course,
  string,
  { rejectValue: FormError }
>("courses/publishCourse", async (courseId, { rejectWithValue }) => {
  try {
    return await requestCoursePublish(courseId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const archiveCourse = createAsyncThunk<
  Course,
  string,
  { rejectValue: FormError }
>("courses/archiveCourse", async (courseId, { rejectWithValue }) => {
  try {
    return await requestCourseArchive(courseId);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

function replaceListCourse(items: CourseListItem[], course: Course): void {
  const index = items.findIndex((item) => item.id === course.id);
  if (index >= 0) {
    items[index] = courseListItemSchema.parse(course);
  }
}

const coursesSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCourses.pending, (state, action) => {
        state.list.status = "loading";
        state.list.requestId = action.meta.requestId;
      })
      .addCase(fetchCourses.fulfilled, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) {
          return;
        }
        state.list.items = action.payload.items;
        state.list.meta = action.payload.meta;
        state.list.status = "ready";
        state.list.requestId = null;
      })
      .addCase(fetchCourses.rejected, (state, action) => {
        if (state.list.requestId !== action.meta.requestId) {
          return;
        }
        state.list.status = "error";
        state.list.requestId = null;
      })
      .addCase(fetchCourse.pending, (state) => {
        state.detail.course = null;
        state.detail.status = "loading";
        state.detail.error = null;
      })
      .addCase(fetchCourse.fulfilled, (state, action) => {
        state.detail.course = action.payload;
        state.detail.status = "ready";
        state.detail.error = null;
      })
      .addCase(fetchCourse.rejected, (state, action) => {
        state.detail.course = null;
        state.detail.status = "error";
        state.detail.error = action.payload ?? toFormError(action.error);
      })
      .addCase(updateCourse.fulfilled, (state, action) => {
        replaceListCourse(state.list.items, action.payload);
        if (state.detail.course?.id === action.payload.id) {
          state.detail.course = { ...state.detail.course, ...action.payload };
        }
      })
      .addCase(publishCourse.fulfilled, (state, action) => {
        replaceListCourse(state.list.items, action.payload);
        if (state.detail.course?.id === action.payload.id) {
          state.detail.course = { ...state.detail.course, ...action.payload };
        }
      })
      .addCase(archiveCourse.fulfilled, (state, action) => {
        replaceListCourse(state.list.items, action.payload);
        if (state.detail.course?.id === action.payload.id) {
          state.detail.course = { ...state.detail.course, ...action.payload };
        }
      })
      .addCase(createLesson.fulfilled, (state, action) => {
        const { courseId } = action.meta.arg;
        if (state.detail.course?.id !== courseId) {
          return;
        }

        state.detail.course.lessons = sortLessons([
          ...state.detail.course.lessons,
          lessonSummarySchema.parse(action.payload),
        ]);
        state.detail.course.lessonsCount += 1;
      })
      .addCase(updateLesson.fulfilled, (state, action) => {
        const { courseId } = action.meta.arg;
        if (state.detail.course?.id !== courseId) {
          return;
        }

        const summary = lessonSummarySchema.parse(action.payload);
        state.detail.course.lessons = sortLessons(
          state.detail.course.lessons.map((lesson) =>
            lesson.id === summary.id ? summary : lesson,
          ),
        );
      })
      .addCase(publishLesson.fulfilled, (state, action) => {
        const { courseId } = action.meta.arg;
        if (state.detail.course?.id !== courseId) {
          return;
        }

        const summary = lessonSummarySchema.parse(action.payload);
        state.detail.course.lessons = sortLessons(
          state.detail.course.lessons.map((lesson) =>
            lesson.id === summary.id ? summary : lesson,
          ),
        );
      })
      .addCase(unpublishLesson.fulfilled, (state, action) => {
        const { courseId } = action.meta.arg;
        if (state.detail.course?.id !== courseId) {
          return;
        }

        const summary = lessonSummarySchema.parse(action.payload);
        state.detail.course.lessons = sortLessons(
          state.detail.course.lessons.map((lesson) =>
            lesson.id === summary.id ? summary : lesson,
          ),
        );
      })
      .addCase(deleteLesson.fulfilled, (state, action) => {
        const { courseId, lessonId } = action.payload;
        if (state.detail.course?.id !== courseId) {
          return;
        }

        state.detail.course.lessons = state.detail.course.lessons.filter(
          (lesson) => lesson.id !== lessonId,
        );
        state.detail.course.lessonsCount -= 1;
      })
      .addCase(reorderLessons.fulfilled, (state, action) => {
        const { courseId } = action.meta.arg;
        if (state.detail.course?.id === courseId) {
          state.detail.course = action.payload;
        }
      });
  },
});

export const coursesReducer = coursesSlice.reducer;
