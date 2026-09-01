import { configureStore } from "@reduxjs/toolkit";

import { setUnauthorizedHandler } from "../api/client";
import { authReducer, sessionExpired } from "../features/auth/authSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
  },
});

setUnauthorizedHandler(() => store.dispatch(sessionExpired()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
