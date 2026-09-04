import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { RouterProvider } from "react-router-dom";

import { router } from "./routes/router";
import { fetchSession } from "./features/auth/authSlice";
import { store } from "./store";
import "./styles/tokens.css";
import "./styles/global.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element was not found");
}

store.dispatch(fetchSession());

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>,
);
