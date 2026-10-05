const CFG = window.IMHOTEP || {};
const State = { user:null, credits:0, unlimited:false, unlimitedUntil:0, messages:[] };

// ─── Toast ───
function toast(msg, type) {
  type = type || "info";
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast " + type;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; }, 4200);
  setTimeout(() => el.remove(), 4600);
}

// ─── Analytics stub ───
function track(event, props) {
  props = props || {};
  if (!CFG.ANALYTICS_ENABLED) return;
  try {
    const buf = JSON.parse(localStorage.getItem("imhotep_analytics") || "[]");
    buf.push({ t: Date.now(), event, props });
    localStorage.setItem("imhotep_analytics", JSON.stringify(buf.slice(-500)));
  } catch (e) {}
}

// ─── Peace word rotation ───
let peaceIdx = 0;
function rotatePeaceWord() {
  const el = document.getElementById("peace-word");
  const langEl = document.getElementById("peace-lang");
  if (!el || !langEl || !CFG.PEACE_WORDS) return;
  el.style.opacity = "0";
  setTimeout(() => {
    const p = CFG.PEACE_WORDS[peaceIdx % CFG.PEACE_WORDS.length];
    el.textContent = p.w;
    langEl.textContent = "— " + p.l + " —";
    el.style.opacity = "1";
    peaceIdx++;
  }, 400);
}

// ─── Clock ───
function tickClock() {
  const now = new Date();
  const tEl = document.getElementById("clock-time");
  const dEl = document.getElementById("clock-date");
  if (tEl) {
    const opts = { hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false };
    tEl.textContent = now.toLocaleTimeString("en-GB",
      Object.assign({}, opts, { timeZone:"Africa/Nairobi" })) + " EAT";
  }
  if (dEl) {
    dEl.textContent = now.toLocaleDateString("en-GB", {
      weekday:"long", day:"numeric", month:"long", year:"numeric",
      timeZone:"Africa/Nairobi"
    });
  }
}

// ─── Google Auth ───
function parseJwt(token) {
  try {
    const base = token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/");
    return JSON.parse(decodeURIComponent(escape(atob(base))));
  } catch (e) { return null; }
}

function handleGoogleCredential(response) {
  const payload = parseJwt(response.credential);
  if (!payload) { toast("Sign-in failed. Try again.", "error"); return; }
  State.user = { email:payload.email, name:payload.name, picture:payload.picture };
  localStorage.setItem("imhotep_user", JSON.stringify(State.user));
  closeAuthModal();
  renderAuthArea();
  toast("Welcome, " + payload.given_name + "!", "success");
  track("signin", { email:payload.email });
  refreshCredits();
}

function renderAuthArea() {
  const el = document.getElementById("auth-area");
  if (!el) return;
  if (!State.user) {
    el.innerHTML = '<button class="signin-nav-btn" onclick="openAuthModal()">Sign in</button>';
    return;
  }
  const creditsLabel = State.unlimited ? "\u221E" : State.credits;
  const firstName = State.user.name.split(" ")[0];
  el.innerHTML =
    '<div id="auth-user">' +
      '<img src="' + State.user.picture + '" alt="">' +
      '<span class="name">' + firstName + '</span>' +
      '<span class="credits" id="credit-badge">' + creditsLabel + '</span>' +
      '<button class="signout-btn" onclick="signOut()" title="Sign out">\u00D7</button>' +
    '</div>';
}

function signOut() {
  State.user = null; State.credits = 0; State.unlimited = false;
  localStorage.removeItem("imhotep_user");
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  renderAuthArea();
  renderChatArea();
  toast("Signed out.", "info");
  track("signout");
}

function openAuthModal() {
  document.getElementById("auth-modal").classList.add("open");
  if (window.google && google.accounts && google.accounts.id && CFG.GOOGLE_CLIENT_ID
      && CFG.GOOGLE_CLIENT_ID.indexOf("YOUR_") !== 0) {
    google.accounts.id.renderButton(
      document.getElementById("google-btn"),
      { theme:"filled_black", size:"large", text:"signin_with", shape:"rectangular", width:280 }
    );
  } else {
    const g = document.getElementById("google-btn");
    if (g) g.innerHTML = '<p style="color:var(--text-5);font-size:0.8rem">' +
      'Google Sign-In is not configured yet. Please set GOOGLE_CLIENT_ID in config.js.</p>';
  }
}
function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("open");
}

// ─── Credits ───
async function refreshCredits() {
  if (!State.user) return;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const r = await fetch(CFG.API_URL + "/user/credits?email=" + encodeURIComponent(State.user.email),
      { signal: controller.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const d = await r.json();
    State.credits = d.credits || 0;
    State.unlimited = !!d.unlimited;
    State.unlimitedUntil = d.unlimited_until || 0;
  } catch (e) {
    console.warn("credits fetch failed", e);
  }
  renderAuthArea();
  renderChatArea();
}

// ─── Chat area ───
function renderChatArea() {
  const lockedEl = document.getElementById("chat-locked");
  const formEl = document.getElementById("chat-form-wrap");
  if (!lockedEl || !formEl) return;
  const needsAuth = !State.user;
  const needsPay  = State.user && State.credits <= 0 && !State.unlimited;

  if (needsAuth) {
    lockedEl.style.display = "block";
    formEl.style.display = "none";
    lockedEl.innerHTML =
      '<h3>Sign in to chat</h3>' +
      '<p>Use your Google account to start chatting with Imhotep.</p>' +
      '<button class="btn" onclick="openAuthModal()">Sign in with Google</button>';
  } else if (needsPay) {
    lockedEl.style.display = "block";
    formEl.style.display = "none";
    lockedEl.innerHTML =
      '<h3>Top up to continue</h3>' +
      '<p>You have <b>0</b> chats left. Choose a plan to keep chatting.</p>' +
      '<a class="btn green" href="' + CFG.NESTLINK_URL + '" target="_blank">Pay 10 KES — 3 chats</a>' +
      '<a class="btn" href="' + CFG.NESTLINK_URL + '" target="_blank">Pay 99 KES — 7-day unlimited</a>' +
      '<button class="btn outline" onclick="startPaymentPolling()" ' +
        'style="background:transparent;border:1.5px solid var(--accent);color:var(--accent)">' +
        'I\\'ve paid — check now</button>';
  } else {
    lockedEl.style.display = "none";
    formEl.style.display = "block";
  }
}

// ─── Payment polling ───
let _pollTimer = null;
function startPaymentPolling() {
  const box = document.getElementById("payment-poll");
  if (!box) return;
  box.classList.add("active");
  box.innerHTML = '<span class="spinner"></span> Checking for your payment…';
  let attempts = 0;
  const before = State.credits;
  if (_pollTimer) clearInterval(_pollTimer);
  _pollTimer = setInterval(async () => {
    attempts++;
    await refreshCredits();
    if (State.credits > before || State.unlimited) {
      clearInterval(_pollTimer); _pollTimer = null;
      box.classList.remove("active");
      toast("Payment received — credits updated!", "success");
      track("payment_confirmed", { credits:State.credits, unlimited:State.unlimited });
      return;
    }
    if (attempts >= 20) {
      clearInterval(_pollTimer); _pollTimer = null;
      box.classList.remove("active");
      toast("Still waiting… payments can take up to 2 min. Try again later.", "info");
    } else {
      box.innerHTML = '<span class="spinner"></span> Checking for your payment… (' +
        attempts + '/20)';
    }
  }, 3000);
}

// ─── Messages ───
function addMsg(role, text) {
  const container = document.getElementById("chat-messages");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addSkeleton() {
  const container = document.getElementById("chat-messages");
  if (!container) return null;
  const div = document.createElement("div");
  div.className = "skeleton";
  div.id = "chat-skeleton";
  div.innerHTML =
    '<div class="skeleton-line w80"></div>' +
    '<div class="skeleton-line"></div>' +
    '<div class="skeleton-line w60"></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ─── History ───
function historyKey() {
  return State.user ? "imhotep_history_" + State.user.email : null;
}
function saveToHistory(role, text) {
  const k = historyKey();
  if (!k) return;
  try {
    const buf = JSON.parse(localStorage.getItem(k) || "[]");
    buf.push({ role, text, ts: Date.now() });
    localStorage.setItem(k, JSON.stringify(buf.slice(-200)));
  } catch (e) {}
}

// ─── Send ───
async function sendMessage(e) {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const btn = document.getElementById("send-btn");
  const text = input.value.trim();
  if (!text) return;
  if (!State.user) { openAuthModal(); return; }
  if (State.credits <= 0 && !State.unlimited) { renderChatArea(); return; }

  addMsg("user", text);
  saveToHistory("user", text);
  input.value = "";
  input.disabled = true;
  btn.disabled = true;
  addSkeleton();
  track("chat_send", { length:text.length });

  let attempt = 0;
  const maxRetries = 1;
  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 120000);
      const r = await fetch(CFG.API_URL + "/chat", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({
          prompt: text,
          user_id: State.user.email,
          email: State.user.email
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      if (r.status === 402) {
        const sk = document.getElementById("chat-skeleton");
        if (sk) sk.remove();
        State.credits = 0;
        renderChatArea();
        toast("No credits left. Please top up.", "error");
        input.disabled = false; btn.disabled = false; return;
      }
      if (!r.ok) {
        const body = await r.text();
        throw new Error("HTTP " + r.status + " — " + body.slice(0,160));
      }
      const d = await r.json();
      const sk = document.getElementById("chat-skeleton");
      if (sk) sk.remove();
      const reply = d.reply || "(no reply)";
      addMsg("assistant", reply);
      saveToHistory("assistant", reply);
      if (typeof d.credits === "number") {
        State.credits = d.credits;
        State.unlimited = !!d.unlimited;
        renderAuthArea();
      }
      track("chat_reply", { source:d.source, took_ms:d.took_ms });
      input.disabled = false; btn.disabled = false; input.focus();
      return;
    } catch (err) {
      attempt++;
      const isNetwork = (err.name === "AbortError") ||
                        /network|failed|fetch/i.test(err.message || "");
      if (attempt <= maxRetries && isNetwork) {
        await new Promise(res => setTimeout(res, 1500));
        continue;
      }
      const sk = document.getElementById("chat-skeleton");
      if (sk) sk.remove();
      addMsg("sys", "⚠️ " + (err.name === "AbortError" ?
        "Request timed out. Please try again." : err.message));
      toast(err.name === "AbortError" ? "Request timed out." : "Request failed.", "error");
      track("chat_error", { message:err.message });
      input.disabled = false; btn.disabled = false; input.focus();
      return;
    }
  }
}

// ─── FAQ toggle ───
function setupFaq() {
  document.querySelectorAll(".faq-item").forEach(function(item) {
    item.addEventListener("click", function() {
      this.classList.toggle("open");
    });
  });
}

// ─── Boot ───
window.addEventListener("DOMContentLoaded", function() {
  const saved = localStorage.getItem("imhotep_user");
  if (saved) { try { State.user = JSON.parse(saved); } catch (e) {} }
  renderAuthArea();
  renderChatArea();
  rotatePeaceWord();
  setInterval(rotatePeaceWord, 3500);
  tickClock();
  setInterval(tickClock, 1000);
  const form = document.getElementById("chat-form");
  if (form) form.addEventListener("submit", sendMessage);
  setupFaq();
  if (State.user) refreshCredits();
  if (window.google && google.accounts && google.accounts.id
      && CFG.GOOGLE_CLIENT_ID && CFG.GOOGLE_CLIENT_ID.indexOf("YOUR_") !== 0) {
    google.accounts.id.initialize({
      client_id: CFG.GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential
    });
    const navBtn = document.getElementById("google-btn-nav");
    if (navBtn) {
      google.accounts.id.renderButton(navBtn, {
        theme:"filled_black", size:"medium", text:"signin_with", shape:"pill"
      });
    }
  }
});

window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.signOut = signOut;
window.refreshCredits = refreshCredits;
window.startPaymentPolling = startPaymentPolling;
window.track = track;
