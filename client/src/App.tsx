import { BrowserRouter, Route, Routes } from "react-router-dom";

import { NotFoundPage } from "./pages/NotFoundPage";

function HomePage() {
  return (
    <main>
      <h1>Corporate Learning</h1>
      <p>Платформа корпоративного обучения готова к работе.</p>
    </main>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
