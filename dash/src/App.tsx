import { lazy, Suspense } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import { I18nProvider } from "./i18n";
import Login from "./pages/Login";
import theme from "./theme";

const Overview = lazy(() => import("./pages/Overview"));
const Composition = lazy(() => import("./pages/Composition"));
const BinHealth = lazy(() => import("./pages/BinHealth"));
const RoutesPage = lazy(() => import("./pages/Routes"));
const Recycling = lazy(() => import("./pages/Recycling"));
const Dumping = lazy(() => import("./pages/Dumping"));
const Carbon = lazy(() => import("./pages/Carbon"));
const Cleanliness = lazy(() => import("./pages/Cleanliness"));
const Bins = lazy(() => import("./pages/Bins"));
const Reports = lazy(() => import("./pages/Reports"));
const Review = lazy(() => import("./pages/Review"));
const Volunteers = lazy(() => import("./pages/Volunteers"));
const Users = lazy(() => import("./pages/Users"));
const OpenData = lazy(() => import("./pages/OpenData"));

function RequireAuth() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="composition" element={<Composition />} />
                <Route path="collect" element={<BinHealth />} />
                <Route path="routes" element={<RoutesPage />} />
                <Route path="recycling" element={<Recycling />} />
                <Route path="dumping" element={<Dumping />} />
                <Route path="carbon" element={<Carbon />} />
                <Route path="cleanliness" element={<Cleanliness />} />
                <Route path="bins" element={<Bins />} />
                <Route path="reports" element={<Reports />} />
                <Route path="review" element={<Review />} />
                <Route path="volunteers" element={<Volunteers />} />
                <Route path="users" element={<Users />} />
                <Route path="open-data" element={<OpenData />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
