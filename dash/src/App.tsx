import { lazy, Suspense } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import LinearProgress from "@mui/material/LinearProgress";
import { ThemeProvider } from "@mui/material/styles";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { getToken } from "./api";
import Layout from "./components/Layout";
import SectionNav from "./components/SectionNav";
import { I18nProvider } from "./i18n";
import { LEGACY_REDIRECTS, NAV } from "./nav";
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
const Audit = lazy(() => import("./pages/Audit"));
const Settings = lazy(() => import("./pages/Settings"));

const kids = (path: string) => NAV.find((e) => e.path === path)!.children!;

function RequireAuth() {
  return getToken() ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <I18nProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense
            fallback={
              <LinearProgress
                color="secondary"
                sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 2000 }}
              />
            }
          >
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RequireAuth />}>
                <Route element={<Layout />}>
                  <Route index element={<Overview />} />
                  <Route path="collect" element={<BinHealth />} />
                  <Route path="routes" element={<RoutesPage />} />

                  <Route
                    path="intelligence"
                    element={
                      <SectionNav
                        description="navIntelligenceDesc"
                        items={kids("/intelligence")}
                      />
                    }
                  >
                    <Route index element={<Navigate to="composition" replace />} />
                    <Route path="composition" element={<Composition />} />
                    <Route path="recycling" element={<Recycling />} />
                    <Route path="carbon" element={<Carbon />} />
                    <Route path="cleanliness" element={<Cleanliness />} />
                    <Route path="dumping" element={<Dumping />} />
                  </Route>

                  <Route
                    path="records"
                    element={
                      <SectionNav
                        description="navRecordsDesc"
                        items={kids("/records")}
                      />
                    }
                  >
                    <Route index element={<Navigate to="bins" replace />} />
                    <Route path="bins" element={<Bins />} />
                    <Route path="reports" element={<Reports />} />
                    <Route path="review" element={<Review />} />
                    <Route path="volunteers" element={<Volunteers />} />
                  </Route>

                  <Route
                    path="admin"
                    element={
                      <SectionNav
                        description="navAdminDesc"
                        items={kids("/admin")}
                      />
                    }
                  >
                    <Route index element={<Navigate to="users" replace />} />
                    <Route path="users" element={<Users />} />
                    <Route path="open-data" element={<OpenData />} />
                    <Route path="audit" element={<Audit />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>

                  {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
                    <Route key={from} path={from.slice(1)} element={<Navigate to={to} replace />} />
                  ))}
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
