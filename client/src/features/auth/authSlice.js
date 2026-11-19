import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    initialLogin: null,
    sessionExpired: false,
  },
  reducers: {
    authenticateUser: (state, { payload }) => {
      state.user = payload.user;
      state.sessionExpired = false;
    },
    deauthenticateUser: (state) => {
      state.user = null;
      state.initialLogin = null;
      state.sessionExpired = false;
    },
    expireSession: (state) => {
      state.user = null;
      state.initialLogin = null;
      state.sessionExpired = true;
    },
    updateUser: (state, { payload }) => {
      state.user = payload.user;
    },
    updateInitialLogin: (state, { payload }) => {
      state.initialLogin = payload.value;
    },
  },
});

export const {
  authenticateUser,
  deauthenticateUser,
  expireSession,
  updateUser,
  updateInitialLogin,
} = authSlice.actions;

export default authSlice.reducer;
