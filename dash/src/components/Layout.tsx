import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken } from "../api";
import { useI18n, type Lang } from "../i18n";

export default function Layout() {
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{t("appName")}</span>
        <nav>
          <NavLink to="/" end>
            {t("overview")}
          </NavLink>
          <NavLink to="/bins">{t("bins")}</NavLink>
          <NavLink to="/reports">{t("reports")}</NavLink>
          <NavLink to="/users">{t("users")}</NavLink>
        </nav>
        <select
          aria-label={t("language")}
          value={lang}
          onChange={(e) => setLang(e.target.value as Lang)}
        >
          <option value="en">EN</option>
          <option value="sw">SW</option>
        </select>
        <button
          className="linklike"
          onClick={() => {
            clearToken();
            navigate("/login");
          }}
        >
          {t("logout")}
        </button>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
