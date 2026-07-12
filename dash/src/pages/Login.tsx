import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";
import { useI18n } from "../i18n";

export default function Login() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    try {
      await login(phone, password);
      navigate("/");
    } catch {
      setError(true);
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={(e) => void onSubmit(e)}>
        <h1>{t("appName")}</h1>
        <label>
          {t("phone")}
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </label>
        <label>
          {t("password")}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <p className="error">{t("loginFailed")}</p>}
        <button className="primary" type="submit">
          {t("login")}
        </button>
      </form>
    </main>
  );
}
