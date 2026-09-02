import { configureStore } from "@reduxjs/toolkit";

import { setUnauthorizedHandler } from "../api/client";
import { authReducer, sessionExpired } from "../features/auth/authSlice";
import { coursesReducer } from "../features/courses/coursesSlice";
import { lessonsReducer } from "../features/lessons/lessonsSlice";
import { testsReducer } from "../features/tests/testsSlice";
import { adminUsersReducer } from "../features/users/adminUsersSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    courses: coursesReducer,
    lessons: lessonsReducer,
    tests: testsReducer,
    adminUsers: adminUsersReducer,
  },
});

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
