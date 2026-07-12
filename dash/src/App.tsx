import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import { I18nProvider } from "./i18n";
import Login from "./pages/Login";

const Overview = lazy(() => import("./pages/Overview"));
const Bins = lazy(() => import("./pages/Bins"));
const Reports = lazy(() => import("./pages/Reports"));

function RequireAuth() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="bins" element={<Bins />} />
                <Route path="reports" element={<Reports />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  );
}
