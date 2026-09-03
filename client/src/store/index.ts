import { configureStore } from "@reduxjs/toolkit";

import { setUnauthorizedHandler } from "../api/client";
import { authReducer, sessionExpired } from "../features/auth/authSlice";
import { coursesReducer } from "../features/courses/coursesSlice";
import { learningReducer } from "../features/learning/learningSlice";
import { lessonsReducer } from "../features/lessons/lessonsSlice";
import { testsReducer } from "../features/tests/testsSlice";
import { adminUsersReducer } from "../features/users/adminUsersSlice";
import { statisticsReducer } from "../features/statistics/statisticsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    courses: coursesReducer,
    learning: learningReducer,
    lessons: lessonsReducer,
    tests: testsReducer,
    adminUsers: adminUsersReducer,
    statistics: statisticsReducer,
  },
});

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
