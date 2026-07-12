import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type Role, type User } from "../api";
import { useI18n } from "../i18n";

const ROLES: Role[] = ["collector", "coordinator", "viewer", "admin"];

export default function Users() {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[] | null>(null);
  const [issued, setIssued] = useState<{ userId: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setUsers(await api<User[]>("/api/v1/users"));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function issueToken(user: User) {
    const response = await api<{ access_token: string }>("/api/v1/auth/device-tokens", {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    setIssued({ userId: user.id, token: response.access_token });
    setCopied(false);
  }

  async function revoke(user: User) {
    await api(`/api/v1/users/${user.id}/revoke-tokens`, { method: "POST" });
    if (issued?.userId === user.id) setIssued(null);
  }

  async function copyToken() {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.token);
    setCopied(true);
  }

  if (users === null) return <p className="muted">{t("loading")}</p>;

  return (
    <>
      <section className="cards">
        <UserForm onCreated={reload} />
      </section>
      <div className="card">
        <h2>{t("users")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("phone")}</th>
              <th>{t("role")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td className="mono">{user.phone ?? "—"}</td>
                <td>{user.role}</td>
                <td className="row-actions">
                  {user.role === "collector" && (
                    <button className="secondary" onClick={() => void issueToken(user)}>
                      {t("issueToken")}
                    </button>
                  )}
                  <button className="secondary" onClick={() => void revoke(user)}>
                    {t("revokeTokens")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {issued && (
          <div className="token-panel">
            <p className="muted">{t("tokenIssuedHint")}</p>
            <code className="token">{issued.token}</code>
            <button className="primary" onClick={() => void copyToken()}>
              {copied ? t("copied") : t("copy")}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function UserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("collector");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/v1/users", {
        method: "POST",
        body: JSON.stringify({ name, phone, role, password: password || null }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setName("");
    setPhone("");
    setPassword("");
    await onCreated();
  }

  return (
    <form className="card form" onSubmit={(e) => void onSubmit(e)}>
      <h2>{t("newUser")}</h2>
      <label>
        {t("name")}
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        {t("phone")}
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </label>
      <label>
        {t("role")}
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {ROLES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <label>
        {t("passwordOptional")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit">
        {t("create")}
      </button>
    </form>
  );
}
