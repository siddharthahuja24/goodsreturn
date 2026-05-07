import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const genId = (n) => `GR-${String(n + 1).padStart(4, "0")}`;
const ts = () => new Date().toISOString();
const fmtDate = (d) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

const uploadFile = async (file, returnId, fileType) => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${returnId}/${fileType}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, { upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = supabase.storage.from("documents").getPublicUrl(path);
  return data.publicUrl;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS = {
  pending_invoice: { label: "Awaiting GR Invoice", color: "#B45309", bg: "#FEF3C7" },
  invoice_ready:   { label: "GR Invoice Ready",    color: "#1D4ED8", bg: "#DBEAFE" },
  ready_to_pack:   { label: "Ready to Pack",        color: "#6D28D9", bg: "#EDE9FE" },
  completed:       { label: "Completed",            color: "#065F46", bg: "#D1FAE5" },
};

const ROLES = [
  { id: "owner",    label: "Store Owner / Manager", icon: "🏪", desc: "Initiate & manage returns" },
  { id: "accounts", label: "Accounts Team",          icon: "📊", desc: "Create GR invoices" },
  { id: "packer",   label: "Packer / Warehouse",     icon: "📦", desc: "Pack & dispatch goods" },
];

const NAV = "#0F1B2D";
const ACC = "#C4470A";
const BG  = "#F5F2EC";

const inp = {
  width: "100%", background: "#FAF8F4", border: "1px solid #E5DFD4",
  borderRadius: 10, padding: "12px 14px", fontSize: 14, color: NAV,
  display: "block", marginBottom: 0,
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("grm_user")); } catch { return null; }
  });
  const [returns, setReturns] = useState([]);
  const [screen, setScreen]   = useState("dash");
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const loadReturns = useCallback(async () => {
    const { data, error } = await supabase
      .from("returns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setDbError(error.message);
    else { setReturns(data || []); setDbError(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReturns();
    const ch = supabase
      .channel("returns_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, loadReturns)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [loadReturns]);

  const login = (u) => { localStorage.setItem("grm_user", JSON.stringify(u)); setUser(u); };
  const logout = () => { localStorage.removeItem("grm_user"); setUser(null); };

  const openDetail = (id) => { setActiveId(id); setScreen("detail"); };
  const goBack = () => { setScreen("dash"); setActiveId(null); };

  if (!user) return <Login onLogin={login} />;
  if (loading) return <Splash />;

  if (dbError) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
      <p style={{ fontWeight: 700, color: NAV, fontSize: 16, marginBottom: 8 }}>Database connection error</p>
      <p style={{ color: "#9CA3AF", fontSize: 13, marginBottom: 20, textAlign: "center" }}>{dbError}</p>
      <button onClick={loadReturns} style={{ background: ACC, border: "none", color: "white", borderRadius: 10, padding: "12px 24px", fontWeight: 700, fontSize: 14 }}>Try Again</button>
    </div>
  );

  const active = returns.find((r) => r.id === activeId);

  return (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea { font-family: inherit; outline: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
        button:active { opacity: 0.82; transform: scale(0.98); }
      `}</style>

      {screen === "dash" && (
        <Dashboard user={user} returns={returns} onLogout={logout}
          onCreate={() => setScreen("create")} onSelect={openDetail} onRefresh={loadReturns} />
      )}
      {screen === "create" && (
        <CreateReturn user={user} count={returns.length}
          onSave={async () => { await loadReturns(); setScreen("dash"); }} onBack={goBack} />
      )}
      {screen === "detail" && active && (
        <ReturnDetail ret={active} user={user}
          onUpdate={async () => { await loadReturns(); goBack(); }} onBack={goBack} />
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [step, setStep] = useState("role");
  const [role, setRole] = useState(null);
  const [name, setName] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: NAV, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ width: 64, height: 64, background: ACC, borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }}>📋</div>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 800, color: "#F5F2EC", letterSpacing: -0.5 }}>GoodsReturn</h1>
          <p style={{ color: "#7A8A9A", fontSize: 13, marginTop: 4 }}>Store Return Management System</p>
        </div>

        {step === "role" ? (
          <div>
            <p style={{ color: "#7A8A9A", fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14 }}>Select your role</p>
            {ROLES.map((r) => (
              <button key={r.id} onClick={() => { setRole(r); setStep("name"); }}
                style={{ width: "100%", background: "#1A2A3D", border: "1px solid #2A3F57", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 10, textAlign: "left" }}>
                <span style={{ fontSize: 26 }}>{r.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: "#F5F2EC" }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: "#7A8A9A", marginTop: 2 }}>{r.desc}</div>
                </div>
                <span style={{ marginLeft: "auto", color: "#7A8A9A", fontSize: 18 }}>›</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ background: "#1A2A3D", borderRadius: 18, padding: 24 }}>
            <button onClick={() => setStep("role")} style={{ background: "none", border: "none", color: "#7A8A9A", fontSize: 13, marginBottom: 18 }}>← Back</button>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 36 }}>{role.icon}</span>
              <p style={{ color: "#F5F2EC", fontWeight: 600, marginTop: 6 }}>{role.label}</p>
            </div>
            <p style={{ color: "#7A8A9A", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Your Name</p>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              onKeyDown={(e) => e.key === "Enter" && name.trim() && onLogin({ role: role.id, name: name.trim(), roleLabel: role.label })}
              style={{ width: "100%", background: "#0F1B2D", border: "1px solid #2A3F57", borderRadius: 10, padding: "12px 14px", color: "#F5F2EC", fontSize: 15, marginBottom: 18 }} />
            <button
              onClick={() => name.trim() && onLogin({ role: role.id, name: name.trim(), roleLabel: role.label })}
              disabled={!name.trim()}
              style={{ width: "100%", background: name.trim() ? ACC : "#2A3F57", border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 15, transition: "background 0.2s" }}>
              Sign In →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user, returns, onLogout, onCreate, onSelect, onRefresh }) {
  const [filter, setFilter] = useState("all");

  const pending = returns.filter(
    (r) =>
      (user.role === "accounts" && r.status === "pending_invoice") ||
      (user.role === "owner" && r.status === "invoice_ready") ||
      (user.role === "packer" && r.status === "ready_to_pack")
  ).length;

  const tabs = [
    { id: "all", label: "All" },
    { id: "pending_invoice", label: "Pending" },
    { id: "invoice_ready", label: "Invoice Ready" },
    { id: "ready_to_pack", label: "To Pack" },
    { id: "completed", label: "Completed" },
  ];

  const filtered = filter === "all" ? returns : returns.filter((r) => r.status === filter);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: NAV, padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: 20, fontWeight: 800, color: "#F5F2EC" }}>GoodsReturn</h1>
            <p style={{ color: "#7A8A9A", fontSize: 12, marginTop: 3 }}>{user.name} · {user.roleLabel}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {pending > 0 && (
              <div style={{ background: ACC, color: "white", borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700 }}>
                {pending} action{pending > 1 ? "s" : ""}
              </div>
            )}
            <button onClick={onRefresh} style={{ background: "#1A2A3D", border: "none", color: "#7A8A9A", fontSize: 14, padding: "7px 10px", borderRadius: 8 }}>↻</button>
            <button onClick={onLogout} style={{ background: "#1A2A3D", border: "none", color: "#7A8A9A", fontSize: 12, padding: "7px 12px", borderRadius: 8 }}>Logout</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 14 }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 20, border: "none", fontSize: 12, fontWeight: 600, background: filter === t.id ? ACC : "#1A2A3D", color: filter === t.id ? "white" : "#7A8A9A" }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 14px 100px" }}>
        {user.role === "owner" && (
          <button onClick={onCreate}
            style={{ width: "100%", background: ACC, border: "none", borderRadius: 14, padding: 16, color: "white", fontWeight: 700, fontSize: 15, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            + New Return Request
          </button>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📂</div>
            <p style={{ fontWeight: 600, color: "#374151", fontSize: 16 }}>No returns here</p>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 6 }}>
              {user.role === "owner" ? "Tap the button above to start a new return." : "No tasks for your role yet."}
            </p>
          </div>
        ) : (
          filtered.map((r) => <ReturnCard key={r.id} ret={r} user={user} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

// ─── RETURN CARD ──────────────────────────────────────────────────────────────
function ReturnCard({ ret, user, onSelect }) {
  const m = STATUS[ret.status] || STATUS.completed;
  const needsAction =
    (user.role === "accounts" && ret.status === "pending_invoice") ||
    (user.role === "owner" && ret.status === "invoice_ready") ||
    (user.role === "packer" && ret.status === "ready_to_pack");

  return (
    <div onClick={() => onSelect(ret.id)}
      style={{ background: "#FFF", borderRadius: 14, padding: 16, marginBottom: 10, border: needsAction ? `2px solid ${ACC}` : "1px solid #E5DFD4", cursor: "pointer", position: "relative" }}>
      {needsAction && <div style={{ position: "absolute", top: 12, right: 12, width: 8, height: 8, background: ACC, borderRadius: "50%" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, color: NAV }}>{ret.id}</span>
          <p style={{ fontSize: 13, color: "#7A8A9A", marginTop: 2 }}>{ret.supplier}</p>
        </div>
        <span style={{ background: m.bg, color: m.color, padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{m.label}</span>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {(ret.products || []).slice(0, 3).map((p, i) => (
          <span key={i} style={{ background: BG, color: "#374151", fontSize: 11, padding: "3px 9px", borderRadius: 6, fontWeight: 500 }}>
            {p.name} × {p.qty}
          </span>
        ))}
        {(ret.products || []).length > 3 && (
          <span style={{ background: BG, color: "#9CA3AF", fontSize: 11, padding: "3px 9px", borderRadius: 6 }}>
            +{ret.products.length - 3} more
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, color: "#C4BAB0", marginTop: 10 }}>Created {fmtDate(ret.created_at)} · by {ret.created_by}</p>
    </div>
  );
}

// ─── CREATE RETURN ────────────────────────────────────────────────────────────
function CreateReturn({ user, count, onSave, onBack }) {
  const [supplier, setSupplier] = useState("");
  const [billFile, setBillFile] = useState(null);
  const [billPreview, setBillPreview] = useState(null);
  const [products, setProducts] = useState([{ name: "", qty: "", reason: "" }]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const upd = (i, f, v) => setProducts(products.map((p, idx) => (idx === i ? { ...p, [f]: v } : p)));
  const rem = (i) => setProducts(products.filter((_, idx) => idx !== i));

  const handleBill = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBillFile(file);
    const reader = new FileReader();
    reader.onload = () => setBillPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const ok = supplier.trim() && billFile && products.every((p) => p.name.trim() && p.qty.toString().trim());

  const submit = async () => {
    if (!ok || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id = genId(count);
      const billPhotoUrl = await uploadFile(billFile, id, "bill");
      const newReturn = {
        id,
        status: "pending_invoice",
        supplier: supplier.trim(),
        bill_photo_url: billPhotoUrl,
        products,
        notes,
        created_by: user.name,
        timeline: [{ action: "Return request created", name: user.name, role: user.roleLabel, time: ts() }],
      };
      const { error } = await supabase.from("returns").insert([newReturn]);
      if (error) throw error;
      await onSave();
    } catch (e) {
      setSaveError(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: NAV, padding: "20px 20px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#7A8A9A", fontSize: 14, marginBottom: 10 }}>← Back</button>
        <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800, color: "#F5F2EC" }}>New Return Request</h2>
        <p style={{ color: "#7A8A9A", fontSize: 12, marginTop: 4 }}>Fill in all details before submitting</p>
      </div>

      <div style={{ padding: "20px 14px 100px" }}>
        {saveError && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16, color: "#DC2626", fontSize: 13 }}>
            {saveError}
          </div>
        )}

        <Lbl>Supplier / Company Name</Lbl>
        <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
          placeholder="e.g. Hindustan Unilever Ltd" style={{ ...inp, marginBottom: 0 }} />

        <Lbl>Bill / Invoice Photo</Lbl>
        {billPreview ? (
          <div style={{ position: "relative", marginBottom: 0 }}>
            <img src={billPreview} alt="Bill" style={{ width: "100%", borderRadius: 12, maxHeight: 200, objectFit: "cover" }} />
            <button onClick={() => { setBillFile(null); setBillPreview(null); }}
              style={{ position: "absolute", top: 8, right: 8, background: "#DC2626", border: "none", color: "white", borderRadius: "50%", width: 28, height: 28, fontSize: 16 }}>×</button>
          </div>
        ) : (
          <label style={{ display: "block", border: "2px dashed #D8D0C4", borderRadius: 12, padding: "28px", textAlign: "center", cursor: "pointer", background: "#FAFAF7" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📷</div>
            <p style={{ color: "#7A8A9A", fontSize: 13, fontWeight: 500 }}>Tap to take photo or upload</p>
            <p style={{ color: "#C4BAB0", fontSize: 11, marginTop: 4 }}>JPG, PNG or PDF</p>
            <input type="file" accept="image/*" capture="environment" onChange={handleBill} style={{ display: "none" }} />
          </label>
        )}

        <Lbl>Products to Return</Lbl>
        {products.map((p, i) => (
          <div key={i} style={{ background: "#FFF", border: "1px solid #E5DFD4", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#7A8A9A" }}>ITEM {i + 1}</span>
              {products.length > 1 && (
                <button onClick={() => rem(i)} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 13 }}>Remove</button>
              )}
            </div>
            <input value={p.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Product name" style={{ ...inp, marginBottom: 8 }} />
            <input value={p.qty} onChange={(e) => upd(i, "qty", e.target.value)} placeholder="Quantity (e.g. 5 units)" style={{ ...inp, marginBottom: 8 }} />
            <input value={p.reason} onChange={(e) => upd(i, "reason", e.target.value)} placeholder="Reason for return (optional)" style={{ ...inp }} />
          </div>
        ))}
        <button onClick={() => setProducts([...products, { name: "", qty: "", reason: "" }])}
          style={{ width: "100%", background: BG, border: "1px dashed #C4BAB0", borderRadius: 10, padding: 12, color: "#7A8A9A", fontSize: 13, fontWeight: 600, marginBottom: 0 }}>
          + Add Another Item
        </button>

        <Lbl>Notes for Accounts Team (optional)</Lbl>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Any special instructions..." style={{ ...inp, resize: "vertical" }} />

        <button onClick={submit} disabled={!ok || saving}
          style={{ width: "100%", background: ok && !saving ? ACC : "#D8D0C4", border: "none", borderRadius: 12, padding: 16, color: "white", fontWeight: 700, fontSize: 15, marginTop: 20 }}>
          {saving ? "Uploading & Saving..." : "Submit Return Request →"}
        </button>
      </div>
    </div>
  );
}

// ─── RETURN DETAIL ────────────────────────────────────────────────────────────
function ReturnDetail({ ret, user, onUpdate, onBack }) {
  const [lrNumber, setLrNumber]     = useState("");
  const [lrFile, setLrFile]         = useState(null);
  const [signedFile, setSignedFile] = useState(null);
  const [method, setMethod]         = useState(null);
  const [busy, setBusy]             = useState(false);
  const [err, setErr]               = useState(null);
  const m = STATUS[ret.status] || STATUS.completed;

  const tl = (action) => [...(ret.timeline || []), { action, name: user.name, role: user.roleLabel, time: ts() }];

  const update = async (changes) => {
    const { error } = await supabase.from("returns").update(changes).eq("id", ret.id);
    if (error) throw error;
    await onUpdate();
  };

  const uploadGR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const url = await uploadFile(file, ret.id, "gr-invoice");
      await update({ status: "invoice_ready", gr_invoice_url: url, gr_invoice_at: ts(), timeline: tl("GR Invoice uploaded by accounts team") });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const markPack = async () => {
    setBusy(true); setErr(null);
    try { await update({ status: "ready_to_pack", ready_to_pack_at: ts(), timeline: tl("Marked as Ready to Pack") }); }
    catch (e) { setErr(e.message); setBusy(false); }
  };

  const dispatchCourier = async () => {
    if (!lrNumber.trim() || !lrFile || busy) return;
    setBusy(true); setErr(null);
    try {
      const lrUrl = await uploadFile(lrFile, ret.id, "lr-copy");
      await update({
        status: "completed",
        dispatch: { method: "courier", lr_number: lrNumber, lr_copy_url: lrUrl, date: ts() },
        completed_at: ts(),
        timeline: tl(`Dispatched via Courier · LR: ${lrNumber}`),
      });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const dispatchPickup = async () => {
    if (!signedFile || busy) return;
    setBusy(true); setErr(null);
    try {
      const signedUrl = await uploadFile(signedFile, ret.id, "signed-invoice");
      await update({
        status: "completed",
        dispatch: { method: "pickup", signed_invoice_url: signedUrl, date: ts() },
        completed_at: ts(),
        timeline: tl("Goods picked up by party · Signed invoice saved"),
      });
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ background: NAV, padding: "20px 20px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#7A8A9A", fontSize: 14, marginBottom: 10 }}>← Back</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 800, color: "#F5F2EC" }}>{ret.id}</h2>
            <p style={{ color: "#7A8A9A", fontSize: 13, marginTop: 3 }}>{ret.supplier}</p>
          </div>
          <span style={{ background: m.bg, color: m.color, padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>{m.label}</span>
        </div>
      </div>

      <div style={{ padding: "16px 14px 100px" }}>
        {err && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 14px", marginBottom: 16, color: "#DC2626", fontSize: 13 }}>
            {err}
          </div>
        )}

        {/* ACCOUNTS: Upload GR Invoice */}
        {user.role === "accounts" && ret.status === "pending_invoice" && (
          <ACard title="Upload GR Invoice" color="#1D4ED8" icon="📄">
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>Create and upload the Goods Return invoice. The store owner will be notified instantly.</p>
            <label style={{ display: "block", border: "2px dashed #BFDBFE", borderRadius: 10, padding: "22px", textAlign: "center", cursor: busy ? "default" : "pointer", background: "#EFF6FF", opacity: busy ? 0.6 : 1 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📤</div>
              <p style={{ color: "#1D4ED8", fontSize: 14, fontWeight: 600 }}>{busy ? "Uploading..." : "Tap to upload GR Invoice"}</p>
              <p style={{ color: "#93C5FD", fontSize: 12, marginTop: 2 }}>Image or PDF accepted</p>
              {!busy && <input type="file" accept="image/*,.pdf" onChange={uploadGR} style={{ display: "none" }} />}
            </label>
          </ACard>
        )}

        {/* OWNER: Review & mark ready to pack */}
        {user.role === "owner" && ret.status === "invoice_ready" && (
          <ACard title="GR Invoice is Ready!" color={ACC} icon="✅">
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>The accounts team has uploaded the GR Invoice. Review it and mark ready to pack.</p>
            {ret.gr_invoice_url && <DocView src={ret.gr_invoice_url} label="GR Invoice" />}
            <button onClick={markPack} disabled={busy}
              style={{ width: "100%", background: busy ? "#D8D0C4" : ACC, border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 14, marginTop: 14 }}>
              {busy ? "Saving..." : "Mark as Ready to Pack →"}
            </button>
          </ACard>
        )}

        {/* PACKER / OWNER: Dispatch */}
        {(user.role === "packer" || user.role === "owner") && ret.status === "ready_to_pack" && (
          <ACard title="Ready to Dispatch" color="#6D28D9" icon="📦">
            {ret.gr_invoice_url && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: "#7A8A9A", marginBottom: 8, fontWeight: 600 }}>GR INVOICE</p>
                <DocView src={ret.gr_invoice_url} label="GR Invoice" />
              </div>
            )}
            {!method ? (
              <div>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>How will the goods be dispatched?</p>
                <button onClick={() => setMethod("courier")}
                  style={{ width: "100%", background: "#4C1D95", border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
                  🚚 Send via Courier
                </button>
                <button onClick={() => setMethod("pickup")}
                  style={{ width: "100%", background: "#1E40AF", border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 14 }}>
                  🤝 Party Pickup
                </button>
              </div>
            ) : method === "courier" ? (
              <div>
                <button onClick={() => setMethod(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, marginBottom: 12 }}>← Change method</button>
                <Lbl>LR Number / Tracking ID</Lbl>
                <input value={lrNumber} onChange={(e) => setLrNumber(e.target.value)}
                  placeholder="Enter LR or docket number" style={{ ...inp, marginBottom: 0 }} />
                <Lbl>Upload LR Copy</Lbl>
                <FileUpload file={lrFile} onSelect={setLrFile} onClear={() => setLrFile(null)} label="LR copy photo or PDF" />
                <button onClick={dispatchCourier} disabled={!lrNumber.trim() || !lrFile || busy}
                  style={{ width: "100%", background: lrNumber.trim() && lrFile && !busy ? "#065F46" : "#D8D0C4", border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 14, marginTop: 16 }}>
                  {busy ? "Uploading..." : "✓ Mark Dispatched via Courier"}
                </button>
              </div>
            ) : (
              <div>
                <button onClick={() => setMethod(null)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: 13, marginBottom: 12 }}>← Change method</button>
                <Lbl>Upload Signed GR Invoice</Lbl>
                <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Take a photo of the invoice signed by the party representative.</p>
                <FileUpload file={signedFile} onSelect={setSignedFile} onClear={() => setSignedFile(null)} label="Photo of signed invoice" accept="image/*" />
                <button onClick={dispatchPickup} disabled={!signedFile || busy}
                  style={{ width: "100%", background: signedFile && !busy ? "#065F46" : "#D8D0C4", border: "none", borderRadius: 10, padding: 14, color: "white", fontWeight: 700, fontSize: 14, marginTop: 16 }}>
                  {busy ? "Uploading..." : "✓ Confirm Pickup & Complete"}
                </button>
              </div>
            )}
          </ACard>
        )}

        <Sec title="Original Bill Photo">
          {ret.bill_photo_url ? <DocView src={ret.bill_photo_url} label="Supplier Bill" /> : <Empty />}
        </Sec>

        <Sec title="Products to Return">
          {(ret.products || []).map((p, i) => (
            <div key={i} style={{ background: "#FFF", border: "1px solid #E5DFD4", borderRadius: 10, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, color: NAV }}>{p.name}</p>
                {p.reason && <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>Reason: {p.reason}</p>}
              </div>
              <span style={{ background: BG, color: "#374151", fontSize: 12, padding: "3px 9px", borderRadius: 6, fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>× {p.qty}</span>
            </div>
          ))}
        </Sec>

        {ret.gr_invoice_url && (
          <Sec title="GR Invoice">
            <DocView src={ret.gr_invoice_url} label="GR Invoice" />
            {ret.gr_invoice_at && <p style={{ fontSize: 11, color: "#C4BAB0", marginTop: 6 }}>Uploaded {fmtDate(ret.gr_invoice_at)}</p>}
          </Sec>
        )}

        {ret.dispatch && (
          <Sec title="Dispatch Details">
            <div style={{ background: "#FFF", border: "1px solid #E5DFD4", borderRadius: 12, padding: 16 }}>
              {ret.dispatch.method === "courier" ? (
                <>
                  <Row label="Method" val="🚚 Sent via Courier" />
                  <Row label="LR Number" val={ret.dispatch.lr_number} />
                  <Row label="Date" val={fmtDate(ret.dispatch.date)} />
                  {ret.dispatch.lr_copy_url && <div style={{ marginTop: 12 }}><DocView src={ret.dispatch.lr_copy_url} label="LR Copy" /></div>}
                </>
              ) : (
                <>
                  <Row label="Method" val="🤝 Party Pickup" />
                  <Row label="Date" val={fmtDate(ret.dispatch.date)} />
                  {ret.dispatch.signed_invoice_url && <div style={{ marginTop: 12 }}><DocView src={ret.dispatch.signed_invoice_url} label="Signed Invoice" /></div>}
                </>
              )}
            </div>
          </Sec>
        )}

        <Sec title="Activity Timeline">
          {(ret.timeline || []).map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: i < ret.timeline.length - 1 ? 16 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 9, height: 9, background: ACC, borderRadius: "50%", marginTop: 4 }} />
                {i < ret.timeline.length - 1 && <div style={{ width: 1, flex: 1, background: "#E5DFD4", margin: "4px 0" }} />}
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: NAV, lineHeight: 1.4 }}>{t.action}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>{t.name} · {t.role} · {fmtDate(t.time)}</p>
              </div>
            </div>
          ))}
        </Sec>

        <Sec title="Return Info">
          <div style={{ background: "#FFF", border: "1px solid #E5DFD4", borderRadius: 12, padding: 16 }}>
            <Row label="Return ID" val={ret.id} />
            <Row label="Created by" val={ret.created_by} />
            <Row label="Created at" val={fmtDate(ret.created_at)} />
            {ret.notes && <Row label="Notes" val={ret.notes} />}
          </div>
        </Sec>
      </div>
    </div>
  );
}

// ─── Shared UI components ─────────────────────────────────────────────────────

function Lbl({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 20 }}>{children}</p>;
}

function ACard({ title, color, icon, children }) {
  return (
    <div style={{ background: "#FFF", borderRadius: 16, padding: 20, marginBottom: 22, borderTop: `1px solid ${color}33`, borderRight: `1px solid ${color}33`, borderBottom: `1px solid ${color}33`, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 700, color }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>{title}</p>
      {children}
    </div>
  );
}

function DocView({ src, label }) {
  const isImg = src && (src.startsWith("data:image") || /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(src));
  return isImg ? (
    <a href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={label} style={{ width: "100%", borderRadius: 10, maxHeight: 220, objectFit: "cover", border: "1px solid #E5DFD4", display: "block" }} />
    </a>
  ) : (
    <a href={src} target="_blank" rel="noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 10, background: BG, padding: "14px", borderRadius: 10, textDecoration: "none" }}>
      <span style={{ fontSize: 22 }}>📄</span>
      <span style={{ color: "#1D4ED8", fontWeight: 600, fontSize: 14 }}>{label} — Tap to Open</span>
    </a>
  );
}

function FileUpload({ file, onSelect, onClear, label, accept = "image/*,.pdf" }) {
  if (file)
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: BG, padding: "12px 14px", borderRadius: 10 }}>
        <span style={{ fontSize: 20 }}>📄</span>
        <span style={{ fontSize: 13, color: NAV, flex: 1, wordBreak: "break-word" }}>{file.name}</span>
        <button onClick={onClear} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 18, flexShrink: 0 }}>×</button>
      </div>
    );
  return (
    <label style={{ display: "block", border: "2px dashed #D8D0C4", borderRadius: 10, padding: "22px", textAlign: "center", cursor: "pointer", background: "#FAFAF7" }}>
      <div style={{ fontSize: 26, marginBottom: 6 }}>📷</div>
      <p style={{ color: "#7A8A9A", fontSize: 13, fontWeight: 500 }}>{label}</p>
      <input type="file" accept={accept} onChange={(e) => onSelect(e.target.files[0])} style={{ display: "none" }} />
    </label>
  );
}

function Row({ label, val }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "7px 0", borderBottom: "1px solid #F5F2EC" }}>
      <span style={{ fontSize: 12, color: "#9CA3AF", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: NAV, fontWeight: 500, maxWidth: "62%", textAlign: "right", marginLeft: 8 }}>{val}</span>
    </div>
  );
}

function Empty() {
  return <p style={{ color: "#C4BAB0", fontSize: 13 }}>Not uploaded yet</p>;
}

function Splash() {
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: NAV, gap: 16 }}>
      <div style={{ width: 48, height: 48, background: ACC, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>📋</div>
      <p style={{ color: "#F5F2EC", fontFamily: "Syne, sans-serif", fontSize: 16 }}>Connecting to database...</p>
    </div>
  );
}
