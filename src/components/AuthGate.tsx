import { useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

type Mode = "login" | "signup";

/**
 * Primary app gate: HK phone + password.
 * Site admin PIN protects Admin tools only (admin account only).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, user, login, signup } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <div className="auth-gate auth-gate-loading">
        <p className="meta">載入中…</p>
      </div>
    );
  }

  if (user) return <>{children}</>;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password !== confirm) throw new Error("兩次密碼不一致。");
        await signup(phone, password);
        setMode("login");
        setPassword("");
        setConfirm("");
        setInfo("註冊成功。帳戶待管理員審批後才可登入。");
      } else {
        await login(phone, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "出咗問題，請再試。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-gate">
      <form className="auth-card checkout-form" onSubmit={onSubmit}>
        <p className="auth-brand">Orderlo</p>
        <p className="meta">
          {mode === "login"
            ? "用香港手機號碼同密碼登入。"
            : "註冊帳戶 — 8 位香港手機號碼 + 自訂密碼。註冊後需管理員批准。"}
        </p>

        <label>
          香港手機
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 12))
            }
            placeholder="91234567"
            required
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="最少 4 個字元"
            minLength={4}
            required
          />
        </label>
        {mode === "signup" ? (
          <label>
            確認密碼
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="再輸入一次"
              minLength={4}
              required
            />
          </label>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}
        {info ? <p className="auth-info">{info}</p> : null}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy ? "請稍候…" : mode === "login" ? "登入" : "註冊"}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
        >
          {mode === "login" ? "未有帳戶？註冊" : "已有帳戶？登入"}
        </button>
      </form>
    </div>
  );
}
