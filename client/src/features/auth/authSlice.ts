import { publicUserSchema } from "@lms/shared";
import type {
  ChangePasswordBody,
  LoginBody,
  PublicUser,
  RegisterBody,
  UpdateProfileBody,
} from "@lms/shared";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { ApiError } from "../../api/ApiError";
import { toFormError } from "../../api/formError";
import type { FormError } from "../../api/formError";
import { updateAdminUser } from "../users/adminUsersSlice";
import {
  requestLogin,
  requestLogout,
  requestPasswordChange,
  requestProfileUpdate,
  requestRegister,
  requestSession,
} from "./authApi";

export type AuthStatus =
  "idle" | "loading" | "authenticated" | "anonymous" | "error";

export type AuthState = {
  user: PublicUser | null;
  status: AuthStatus;
};

const initialState: AuthState = {
  user: null,
  status: "idle",
};

export const fetchSession = createAsyncThunk<
  PublicUser | null,
  void,
  { rejectValue: FormError }
>("auth/fetchSession", async (_argument, { rejectWithValue }) => {
  try {
    return (await requestSession()).user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    return rejectWithValue(toFormError(error));
  }
});

export const login = createAsyncThunk<
  PublicUser,
  LoginBody,
  { rejectValue: FormError }
>("auth/login", async (body, { rejectWithValue }) => {
  try {
    return (await requestLogin(body)).user;
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const register = createAsyncThunk<
  PublicUser,
  RegisterBody,
  { rejectValue: FormError }
>("auth/register", async (body, { rejectWithValue }) => {
  try {
    return (await requestRegister(body)).user;
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const logout = createAsyncThunk<void, void, { rejectValue: FormError }>(
  "auth/logout",
  async (_argument, { rejectWithValue }) => {
    try {
      await requestLogout();
    } catch (error) {
      return rejectWithValue(toFormError(error));
    }
  },
);

export const updateProfile = createAsyncThunk<
  PublicUser,
  UpdateProfileBody,
  { rejectValue: FormError }
>("auth/updateProfile", async (body, { rejectWithValue }) => {
  try {
    return (await requestProfileUpdate(body)).user;
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

export const changePassword = createAsyncThunk<
  void,
  ChangePasswordBody,
  { rejectValue: FormError }
>("auth/changePassword", async (body, { rejectWithValue }) => {
  try {
    await requestPasswordChange(body);
  } catch (error) {
    return rejectWithValue(toFormError(error));
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionExpired(state) {
      state.user = null;
      state.status = "anonymous";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSession.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = action.payload ? "authenticated" : "anonymous";
      })
      .addCase(fetchSession.rejected, (state) => {
        state.user = null;
        state.status = "error";
      })
      .addCase(login.pending, (state) => {
        state.status = "loading";
      })
      .addCase(login.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(login.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(register.pending, (state) => {
        state.status = "loading";
      })
      .addCase(register.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(register.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(logout.rejected, (state) => {
        state.user = null;
        state.status = "anonymous";
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "authenticated";
      })
      .addCase(updateAdminUser.fulfilled, (state, action) => {
        if (state.user?.id === action.payload.id) {
          state.user = publicUserSchema.parse(action.payload);
        }
      });
  },
});

export const { sessionExpired } = authSlice.actions;
export const authReducer = authSlice.reducer;
