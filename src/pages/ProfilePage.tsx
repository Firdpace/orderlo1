import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { displayPhone } from "../lib/auth";
import {
  addShop,
  listShopsForUser,
  removeShop,
  updateShop,
  type Shop,
} from "../lib/shops";

export function ProfilePage() {
  const { user, logout, changePassword, adminUnlocked } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopStatus, setShopStatus] = useState<string | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwStatus, setPwStatus] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setShops(listShopsForUser(user.id));
  }, [user]);

  if (!user) return null;

  const resetShopForm = () => {
    setName("");
    setAddress("");
    setEditingId(null);
    setShopError(null);
  };

  const onShopSubmit = (event: FormEvent) => {
    event.preventDefault();
    setShopError(null);
    setShopStatus(null);
    try {
      const next = editingId
        ? updateShop(user.id, editingId, {
            name,
            deliveryAddress: address,
          })
        : addShop(user.id, { name, deliveryAddress: address });
      setShops(next);
      setShopStatus(editingId ? "已更新店舖。" : "已新增店舖。");
      resetShopForm();
    } catch (e) {
      setShopError(e instanceof Error ? e.message : "儲存失敗。");
    }
  };

  const startEdit = (shop: Shop) => {
    setEditingId(shop.id);
    setName(shop.name);
    setAddress(shop.deliveryAddress);
    setShopError(null);
    setShopStatus(null);
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPwError(null);
    setPwStatus(null);
    if (nextPw !== confirmPw) {
      setPwError("兩次新密碼不一致。");
      return;
    }
    if (nextPw.length < 4) {
      setPwError("新密碼最少 4 個字元。");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(currentPw, nextPw);
      setPwStatus("密碼已更新。");
      setCurrentPw("");
      setNextPw("");
      setConfirmPw("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "無法更改密碼。");
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>我的</h1>
        <p>
          {displayPhone(user.phoneE164)}
          {user.isAdmin ? " · 管理員帳戶" : " · 更改密碼同管理店舖"}
        </p>
      </header>

      <section className="admin-card">
        <h2>更改密碼</h2>
        <p className="meta">請輸入現有密碼，再設新密碼（最少 4 個字元）。</p>
        <form className="checkout-form" onSubmit={(e) => void onPasswordSubmit(e)}>
          <label>
            現有密碼
            <input
              type="password"
              autoComplete="current-password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              minLength={4}
              required
            />
          </label>
          <label>
            新密碼
            <input
              type="password"
              autoComplete="new-password"
              value={nextPw}
              onChange={(e) => setNextPw(e.target.value)}
              placeholder="最少 4 個字元"
              minLength={4}
              required
            />
          </label>
          <label>
            確認新密碼
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="再輸入一次"
              minLength={4}
              required
            />
          </label>
          {pwError ? <p className="form-error">{pwError}</p> : null}
          {pwStatus ? <p className="admin-status">{pwStatus}</p> : null}
          <button
            type="submit"
            className="btn btn-secondary btn-block"
            disabled={pwBusy}
          >
            {pwBusy ? "更新中…" : "更新密碼"}
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>我的店舖</h2>
        <p className="meta">
          每間店舖需有名稱同送貨地址。複製 WhatsApp
          落單訊息前要揀一間店舖。
        </p>

        {shops.length === 0 ? (
          <p className="meta">未有店舖 — 請先新增，否則無法複製落單訊息。</p>
        ) : (
          <ul className="shop-list">
            {shops.map((shop) => (
              <li key={shop.id} className="shop-row">
                <div className="shop-row-head">
                  <strong className="shop-row-name">{shop.name}</strong>
                  <div className="shop-row-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon shop-row-action"
                      aria-label="編輯"
                      title="編輯"
                      onClick={() => startEdit(shop)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon shop-row-action"
                      aria-label="刪除"
                      title="刪除"
                      onClick={() => {
                        if (!confirm(`刪除「${shop.name}」？`)) return;
                        setShops(removeShop(user.id, shop.id));
                        if (editingId === shop.id) resetShopForm();
                        setShopStatus("已刪除店舖。");
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="meta shop-row-address">{shop.deliveryAddress}</p>
              </li>
            ))}
          </ul>
        )}

        <form className="checkout-form" onSubmit={onShopSubmit}>
          <h3 className="shop-form-title">
            {editingId ? "編輯店舖" : "新增店舖"}
          </h3>
          <label>
            店舖名稱
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：旺角分店"
              required
            />
          </label>
          <label>
            送貨地址
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="完整送貨地址"
              rows={3}
              required
            />
          </label>
          {shopError ? <p className="form-error">{shopError}</p> : null}
          {shopStatus ? <p className="admin-status">{shopStatus}</p> : null}
          <button type="submit" className="btn btn-primary btn-block">
            {editingId ? "儲存更改" : "新增店舖"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={resetShopForm}
            >
              取消編輯
            </button>
          ) : null}
        </form>
      </section>

      <section className="admin-card profile-account-actions">
        <h2>帳戶</h2>
        {user.isAdmin ? (
          <Link
            to={adminUnlocked ? "/admin" : "/admin/login"}
            className="btn btn-secondary btn-block"
          >
            開啟管理員工具
          </Link>
        ) : (
          <p className="meta">管理員工具只限管理員帳戶使用。</p>
        )}
        <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
          登出
        </button>
        <Link to="/carts" className="text-link">
          返回購物車
        </Link>
      </section>
    </div>
  );
}
