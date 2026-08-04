import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Scissors, Mail, Settings, X, Check, Clock, CalendarDays, Sun, Moon, ArrowLeftRight, Loader2 } from "lucide-react";

/* ---------- design tokens ---------- */
const THEMES = {
  dark: {
    bg: "#1B1714", surface: "#241E1A", surfaceAlt: "#2D251F",
    text: "#F2EAE1", textMuted: "#B8AA9C",
    gold: "#C9A227", goldSoft: "#8C7527",
    burgundy: "#8C3A3A", green: "#5C8A5C", red: "#B94A4A",
    border: "#3A312B",
  },
  light: {
    bg: "#F5EFE6", surface: "#FFFFFF", surfaceAlt: "#EFE6D8",
    text: "#241E1A", textMuted: "#6B5F52",
    gold: "#B8860B", goldSoft: "#8C6B0B",
    burgundy: "#7A2E2E", green: "#3F6B3F", red: "#A83232",
    border: "#E0D5C4",
  },
};

const STRIPE = "repeating-linear-gradient(115deg, var(--gold) 0px, var(--gold) 10px, var(--burgundy) 10px, var(--burgundy) 20px, var(--bg) 20px, var(--bg) 30px)";

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
function effectiveDT(o) {
  if (o.status === "accepted" && o.proposedDate) return { date: o.proposedDate, time: o.proposedTime };
  return { date: o.date, time: o.time };
}

/* ---------- storage helpers ---------- */
async function sGet(key, shared) {
  try { const r = await window.storage.get(key, shared); return r ? JSON.parse(r.value) : null; }
  catch { return null; }
}
async function sSet(key, value, shared) {
  try { await window.storage.set(key, JSON.stringify(value), shared); } catch (e) { console.error(e); }
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [role, setRole] = useState(null); // 'master' | 'client'
  const [clientId, setClientId] = useState(null);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({ gapMinutes: 30, opening: "09:00", closing: "20:00" });

  const [authOpen, setAuthOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [ordersPanelOpen, setOrdersPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const T = THEMES[theme];

  /* initial load */
  useEffect(() => {
    (async () => {
      const [savedRole, savedTheme, savedClientId, savedOrders, savedSettings] = await Promise.all([
        sGet("role", false), sGet("theme", false), sGet("clientId", false),
        sGet("orders", true), sGet("settings", true),
      ]);
      if (savedRole) setRole(savedRole);
      if (savedTheme) setTheme(savedTheme);
      let cid = savedClientId;
      if (!cid) { cid = uid(); await sSet("clientId", cid, false); }
      setClientId(cid);
      if (savedOrders) setOrders(savedOrders);
      if (savedSettings) setSettings(savedSettings);
      setReady(true);
    })();
  }, []);

  const persistOrders = useCallback(async (next) => {
    setOrders(next);
    await sSet("orders", next, true);
  }, []);
  const persistSettings = useCallback(async (next) => {
    setSettings(next);
    await sSet("settings", next, true);
  }, []);
  const changeTheme = useCallback(async (t) => {
    setTheme(t);
    await sSet("theme", t, false);
  }, []);

  const becomeMaster = useCallback(async () => {
    setRole("master");
    await sSet("role", "master", false);
    setAuthOpen(false);
  }, []);

  const pendingUnseen = useMemo(
    () => orders.filter(o => o.status === "pending" && !o.seenByMaster).length,
    [orders]
  );
  const myOrders = useMemo(
    () => orders.filter(o => o.clientId === clientId).sort((a, b) => b.createdAt - a.createdAt),
    [orders, clientId]
  );

  if (!ready) {
    return (
      <div style={{ background: T.bg, color: T.text }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div
      style={{ "--bg": T.bg, "--gold": T.gold, "--burgundy": T.burgundy, background: T.bg, color: T.text, minHeight: "100vh" }}
      className="font-sans transition-colors duration-300"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .font-display { font-family: 'Oswald', sans-serif; letter-spacing: 0.02em; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .stripe-bar { height: 6px; background: ${STRIPE}; background-size: 42px 6px; }
        @keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to {opacity:1; transform:translateY(0);} }
        .fade-up { animation: fadeUp .35s ease both; }
        @keyframes scaleIn { from { opacity:0; transform: scale(.96);} to {opacity:1; transform:scale(1);} }
        .scale-in { animation: scaleIn .25s cubic-bezier(.2,.8,.2,1) both; }
        .btn-primary { transition: transform .18s ease, box-shadow .18s ease, background .18s ease; }
        .btn-primary:hover { transform: translateY(-2px); }
        .btn-primary:active { transform: translateY(0px) scale(.98); }
        .icon-btn { transition: background .15s ease, transform .15s ease; }
        .icon-btn:hover { transform: translateY(-1px); }
      `}</style>

      <Header
        T={T} role={role} pendingUnseen={pendingUnseen}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenOrders={() => setOrdersPanelOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="stripe-bar" />

      {role === "master" ? (
        <MasterHome T={T} orders={orders} settings={settings} onOpenOrders={() => setOrdersPanelOpen(true)} pendingUnseen={pendingUnseen} />
      ) : (
        <ClientHome T={T} onBook={() => setBookingOpen(true)} myOrders={myOrders} />
      )}

      {authOpen && <MasterAuthModal T={T} onClose={() => setAuthOpen(false)} onSuccess={becomeMaster} />}
      {bookingOpen && (
        <BookingModal
          T={T} settings={settings} orders={orders} clientId={clientId}
          onClose={() => setBookingOpen(false)}
          onSubmit={async (order) => { await persistOrders([...orders, order]); setBookingOpen(false); }}
        />
      )}
      {ordersPanelOpen && role === "master" && (
        <OrdersPanel
          T={T} orders={orders}
          onClose={async () => {
            const next = orders.map(o => o.status === "pending" ? { ...o, seenByMaster: true } : o);
            await persistOrders(next);
            setOrdersPanelOpen(false);
          }}
          onUpdate={persistOrders}
        />
      )}
      {settingsOpen && role === "master" && (
        <SettingsPanel
          T={T} settings={settings} theme={theme}
          onClose={() => setSettingsOpen(false)}
          onSaveSettings={persistSettings}
          onChangeTheme={changeTheme}
        />
      )}
    </div>
  );
}

/* ---------- Header ---------- */
function Header({ T, role, pendingUnseen, onOpenAuth, onOpenOrders, onOpenSettings }) {
  return (
    <header className="flex items-center justify-between px-5 sm:px-8 py-4">
      <div className="flex items-center gap-3">
        {role === "master" && (
          <button onClick={onOpenSettings} className="icon-btn p-2 rounded-full" style={{ background: T.surfaceAlt }} aria-label="Настройки">
            <Settings size={20} color={T.text} />
          </button>
        )}
        <div className="flex items-center gap-2">
          <Scissors size={22} color={T.gold} />
          <span className="font-display text-lg sm:text-xl font-semibold" style={{ color: T.text }}>ЗОЛОТАЯ БРИТВА</span>
        </div>
      </div>

      {role === "master" ? (
        <button onClick={onOpenOrders} className="icon-btn relative p-2.5 rounded-full" style={{ background: T.surfaceAlt }} aria-label="Заказы">
          <Mail size={20} color={T.text} />
          {pendingUnseen > 0 && (
            <span
              className="absolute -top-1 -right-1 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: T.red, width: 20, height: 20 }}
            >
              {pendingUnseen}
            </span>
          )}
        </button>
      ) : (
        <button onClick={onOpenAuth} className="text-xs sm:text-sm opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.textMuted }}>
          Я — мастер
        </button>
      )}
    </header>
  );
}

/* ---------- Client home ---------- */
function ClientHome({ T, onBook, myOrders }) {
  return (
    <main className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto">
      <section className="text-center pt-10 pb-8 fade-up">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: T.gold }}>Мужской барбершоп</p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold mb-3">Стрижка, которую видно за квартал</h1>
        <p style={{ color: T.textMuted }} className="text-sm sm:text-base">Выберите время — остальное сделаем мы.</p>
      </section>

      <div
        className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 fade-up"
        style={{ background: T.surface, border: `1px solid ${T.border}` }}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl" style={{ background: T.surfaceAlt }}>
            <Scissors size={28} color={T.gold} />
          </div>
          <div>
            <div className="font-display text-xl font-semibold">Стрижка — 500 ₽</div>
            <div className="text-sm" style={{ color: T.textMuted }}>~40 минут · мытьё и укладка включены</div>
          </div>
        </div>
      </div>

      <button
        onClick={onBook}
        className="btn-primary w-full mt-6 rounded-xl py-4 font-display text-lg font-semibold"
        style={{ background: T.gold, color: T.bg }}
      >
        Записаться
      </button>

      {myOrders.length > 0 && (
        <section className="mt-10 space-y-3">
          <h2 className="text-xs uppercase tracking-widest mb-1" style={{ color: T.textMuted }}>Ваши записи</h2>
          {myOrders.map(o => <ClientOrderCard key={o.id} T={T} order={o} myOrders={myOrders} />)}
        </section>
      )}
    </main>
  );
}

function ClientOrderCard({ T, order, myOrders }) {
  const [respondedTo, setRespondedTo] = useState(false);

  async function respond(accept) {
    const all = await sGet("orders", true) || [];
    const next = all.map(o => {
      if (o.id !== order.id) return o;
      if (accept) return { ...o, status: "accepted" };
      return { ...o, status: "rejected", date: o.proposedDate, time: o.proposedTime, rejectedByClient: true };
    });
    await sSet("orders", next, true);
    setRespondedTo(true);
  }

  let banner = null;
  if (order.status === "pending") {
    banner = { text: "Мастер ещё не увидел ваш заказ", color: T.textMuted, bg: T.surfaceAlt };
  } else if (order.status === "accepted") {
    const { date, time } = effectiveDT(order);
    banner = { text: `Мастер одобрил запись на ${time}, ${fmtDate(date)}`, color: T.green, bg: T.surfaceAlt };
  } else if (order.status === "rejected") {
    banner = { text: `Мастер отклонил запись на ${order.time}, ${fmtDate(order.date)}`, color: T.red, bg: T.surfaceAlt };
  } else if (order.status === "reschedule_proposed") {
    banner = { text: `Мастер предлагает перенести на ${order.proposedTime}, ${fmtDate(order.proposedDate)}`, color: T.gold, bg: T.surfaceAlt };
  }

  return (
    <div className="rounded-xl p-4 fade-up" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium">{fmtDate(order.date)} · {order.time}</span>
      </div>
      {order.message && <p className="text-sm mb-2" style={{ color: T.textMuted }}>«{order.message}»</p>}
      {banner && (
        <div className="text-sm rounded-lg px-3 py-2" style={{ background: banner.bg, color: banner.color }}>
          {banner.text}
        </div>
      )}
      {order.status === "reschedule_proposed" && !respondedTo && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => respond(true)} className="btn-primary flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: T.green, color: "#fff" }}>Согласиться</button>
          <button onClick={() => respond(false)} className="btn-primary flex-1 rounded-lg py-2 text-sm font-medium" style={{ background: T.red, color: "#fff" }}>Отказаться</button>
        </div>
      )}
    </div>
  );
}

/* ---------- Master home ---------- */
function MasterHome({ T, orders, settings, onOpenOrders, pendingUnseen }) {
  const today = new Date().toISOString().slice(0, 10);
  const todays = orders.filter(o => {
    const { date } = effectiveDT(o);
    return date === today && (o.status === "accepted" || o.status === "pending");
  }).sort((a, b) => toMinutes(effectiveDT(a).time) - toMinutes(effectiveDT(b).time));

  return (
    <main className="px-5 sm:px-8 pb-20 max-w-2xl mx-auto">
      <section className="pt-10 pb-6 fade-up">
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: T.gold }}>Кабинет мастера</p>
        <h1 className="font-display text-3xl font-semibold mb-2">С возвращением</h1>
        <p style={{ color: T.textMuted }} className="text-sm">
          Рабочие часы: {settings.opening}–{settings.closing} · перерыв между записями {settings.gapMinutes} мин
        </p>
      </section>

      {pendingUnseen > 0 && (
        <button
          onClick={onOpenOrders}
          className="btn-primary w-full mb-6 rounded-xl py-4 font-display font-semibold flex items-center justify-center gap-2"
          style={{ background: T.burgundy, color: "#fff" }}
        >
          <Mail size={18} /> Новых заказов: {pendingUnseen}
        </button>
      )}

      <h2 className="text-xs uppercase tracking-widest mb-3" style={{ color: T.textMuted }}>Сегодня, {fmtDate(today)}</h2>
      {todays.length === 0 ? (
        <div className="rounded-xl p-6 text-center text-sm" style={{ background: T.surface, color: T.textMuted, border: `1px solid ${T.border}` }}>
          На сегодня записей нет
        </div>
      ) : (
        <div className="space-y-3">
          {todays.map(o => (
            <div key={o.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
              <div className="font-display text-lg font-semibold" style={{ color: T.gold }}>{effectiveDT(o).time}</div>
              <div className="flex-1 text-sm" style={{ color: T.textMuted }}>{o.message || "без пожеланий"}</div>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: T.surfaceAlt, color: o.status === "pending" ? T.textMuted : T.green }}>
                {o.status === "pending" ? "ожидает" : "принято"}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------- Modal shell ---------- */
function ModalShell({ T, onClose, title, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className={`scale-in w-full ${wide ? "sm:max-w-lg" : "sm:max-w-md"} rounded-t-2xl sm:rounded-2xl p-6 max-h-[88vh] overflow-y-auto`}
        style={{ background: T.surface, color: T.text, border: `1px solid ${T.border}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <button onClick={onClose} className="icon-btn p-1.5 rounded-full" style={{ background: T.surfaceAlt }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Master auth modal ---------- */
function MasterAuthModal({ T, onClose, onSuccess }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await sGet("masterPassword", true);
      setHasExisting(!!existing);
      setChecking(false);
    })();
  }, []);

  async function submit() {
    if (!pass.trim()) return;
    const existing = await sGet("masterPassword", true);
    if (!existing) {
      await sSet("masterPassword", pass.trim(), true);
      onSuccess();
      return;
    }
    if (existing === pass.trim()) { onSuccess(); return; }
    setError("Неверное слово-пароль");
  }

  return (
    <ModalShell T={T} onClose={onClose} title="Вход для мастера">
      {checking ? (
        <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={20} /></div>
      ) : (
        <>
          <p className="text-sm mb-4" style={{ color: T.textMuted }}>
            {hasExisting ? "Введите ваше слово-пароль." : "Придумайте слово-пароль — оно понадобится только один раз на этом устройстве."}
          </p>
          <input
            type="password" autoFocus value={pass}
            onChange={e => { setPass(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Слово-пароль"
            className="w-full rounded-lg px-4 py-3 mb-2 outline-none text-sm"
            style={{ background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}` }}
          />
          {error && <p className="text-xs mb-2" style={{ color: T.red }}>{error}</p>}
          <button onClick={submit} className="btn-primary w-full rounded-lg py-3 font-medium mt-2" style={{ background: T.gold, color: T.bg }}>
            Войти
          </button>
        </>
      )}
    </ModalShell>
  );
}

/* ---------- Booking modal ---------- */
function BookingModal({ T, settings, orders, clientId, onClose, onSubmit }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function conflict(d, t) {
    if (!d || !t) return false;
    const tm = toMinutes(t);
    if (tm < toMinutes(settings.opening) || tm > toMinutes(settings.closing) - 30) return "Мастер в это время не работает";
    const clash = orders.some(o => {
      if (["rejected"].includes(o.status)) return false;
      const { date: od, time: ot } = effectiveDT(o);
      return od === d && Math.abs(toMinutes(ot) - tm) < settings.gapMinutes;
    });
    if (clash) return `На это время уже есть запись. Отступ между записями — ${settings.gapMinutes} мин`;
    return null;
  }

  function submit() {
    if (!date || !time) { setError("Укажите дату и время"); return; }
    const c = conflict(date, time);
    if (c) { setError(c); return; }
    onSubmit({
      id: uid(), clientId, date, time, message: message.trim(),
      status: "pending", seenByMaster: false, createdAt: Date.now(),
    });
  }

  return (
    <ModalShell T={T} onClose={onClose} title="Записаться на стрижку">
      <div className="space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Дата</label>
          <div className="flex items-center gap-2 mt-1 rounded-lg px-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <CalendarDays size={16} color={T.textMuted} />
            <input type="date" min={todayStr} value={date} onChange={e => { setDate(e.target.value); setError(""); }}
              className="w-full bg-transparent py-3 outline-none text-sm" style={{ color: T.text }} />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Время</label>
          <div className="flex items-center gap-2 mt-1 rounded-lg px-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
            <Clock size={16} color={T.textMuted} />
            <input type="time" value={time} onChange={e => { setTime(e.target.value); setError(""); }}
              className="w-full bg-transparent py-3 outline-none text-sm" style={{ color: T.text }} />
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Пожелания к стрижке</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Например: покороче с боков, чёлку не трогать..."
            rows={3}
            className="w-full mt-1 rounded-lg px-3 py-3 outline-none text-sm resize-none"
            style={{ background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}` }}
          />
        </div>
        {error && <p className="text-xs" style={{ color: T.red }}>{error}</p>}
        <button onClick={submit} className="btn-primary w-full rounded-lg py-3 font-display font-semibold" style={{ background: T.gold, color: T.bg }}>
          Отправить
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Orders panel (master) ---------- */
function OrdersPanel({ T, orders, onClose, onUpdate }) {
  const [proposingId, setProposingId] = useState(null);
  const [proposeDate, setProposeDate] = useState("");
  const [proposeTime, setProposeTime] = useState("");

  const sorted = [...orders]
    .filter(o => o.status !== "rejected" || Date.now() - o.createdAt < 1000 * 60 * 60 * 24 * 7)
    .sort((a, b) => b.createdAt - a.createdAt);

  async function act(id, status) {
    const next = orders.map(o => o.id === id ? { ...o, status, seenByMaster: true } : o);
    await onUpdate(next);
  }

  async function sendProposal(id) {
    if (!proposeDate || !proposeTime) return;
    const next = orders.map(o => o.id === id ? { ...o, status: "reschedule_proposed", proposedDate: proposeDate, proposedTime: proposeTime, seenByMaster: true } : o);
    await onUpdate(next);
    setProposingId(null); setProposeDate(""); setProposeTime("");
  }

  const statusLabel = { pending: "Новый", accepted: "Принят", rejected: "Отклонён", reschedule_proposed: "Ожидает ответа клиента" };

  return (
    <ModalShell T={T} onClose={onClose} title="Заказы" wide>
      {sorted.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: T.textMuted }}>Заказов пока нет</p>
      ) : (
        <div className="space-y-3">
          {sorted.map(o => (
            <div key={o.id} className="rounded-xl p-4" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}` }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-semibold">{fmtDate(o.date)} · {o.time}</span>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: T.surface, color: T.textMuted }}>{statusLabel[o.status]}</span>
              </div>
              {o.message && <p className="text-sm mb-3" style={{ color: T.textMuted }}>«{o.message}»</p>}

              {o.status === "pending" && proposingId !== o.id && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act(o.id, "accepted")} className="btn-primary flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: T.green, color: "#fff" }}>
                    <Check size={14} /> Принять
                  </button>
                  <button onClick={() => setProposingId(o.id)} className="btn-primary flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: T.gold, color: T.bg }}>
                    <ArrowLeftRight size={14} /> Другое время
                  </button>
                  <button onClick={() => act(o.id, "rejected")} className="btn-primary flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium" style={{ background: T.red, color: "#fff" }}>
                    <X size={14} /> Отклонить
                  </button>
                </div>
              )}

              {proposingId === o.id && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <input type="date" value={proposeDate} onChange={e => setProposeDate(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }} />
                  <input type="time" value={proposeTime} onChange={e => setProposeTime(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }} />
                  <button onClick={() => sendProposal(o.id)} className="btn-primary rounded-lg px-3 py-2 text-sm font-medium" style={{ background: T.gold, color: T.bg }}>Предложить</button>
                  <button onClick={() => setProposingId(null)} className="text-xs" style={{ color: T.textMuted }}>отмена</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

/* ---------- Settings panel (master) ---------- */
function SettingsPanel({ T, settings, theme, onClose, onSaveSettings, onChangeTheme }) {
  const [gap, setGap] = useState(settings.gapMinutes);
  const [opening, setOpening] = useState(settings.opening);
  const [closing, setClosing] = useState(settings.closing);
  const [saved, setSaved] = useState(false);

  async function save() {
    await onSaveSettings({ gapMinutes: Number(gap), opening, closing });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <ModalShell T={T} onClose={onClose} title="Настройки">
      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Оформление</label>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onChangeTheme("dark")} className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
              style={{ background: theme === "dark" ? T.gold : T.surfaceAlt, color: theme === "dark" ? T.bg : T.text }}>
              <Moon size={15} /> Тёмная
            </button>
            <button onClick={() => onChangeTheme("light")} className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
              style={{ background: theme === "light" ? T.gold : T.surfaceAlt, color: theme === "light" ? T.bg : T.text }}>
              <Sun size={15} /> Светлая
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Отступ между записями (мин)</label>
          <input type="number" min={0} step={5} value={gap} onChange={e => setGap(e.target.value)}
            className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Начало работы</label>
            <input type="time" value={opening} onChange={e => setOpening(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} />
          </div>
          <div className="flex-1">
            <label className="text-xs uppercase tracking-wide" style={{ color: T.textMuted }}>Закрытие</label>
            <input type="time" value={closing} onChange={e => setClosing(e.target.value)}
              className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, color: T.text }} />
          </div>
        </div>

        <button onClick={save} className="btn-primary w-full rounded-lg py-3 font-display font-semibold" style={{ background: T.gold, color: T.bg }}>
          {saved ? "Сохранено ✓" : "Сохранить"}
        </button>
      </div>
    </ModalShell>
  );
}
