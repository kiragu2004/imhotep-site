// ═══════════════════════════════════════════════════════════════
// Imhotep frontend
// ═══════════════════════════════════════════════════════════════
const API_URL    = window.IMHOTEP_CONFIG.API_URL;
const CLIENT_ID  = window.IMHOTEP_CONFIG.GOOGLE_CLIENT_ID;

const authGate    = document.getElementById("auth-gate");
const chatSec     = document.getElementById("chat");
const userNameEl  = document.getElementById("user-name");
const messagesEl  = document.getElementById("messages");
const form        = document.getElementById("chat-form");
const promptIn    = document.getElementById("prompt");
const sendBtn     = document.getElementById("send-btn");
const statusEl    = document.getElementById("status");
const signoutBtn  = document.getElementById("signout-btn");
const authStat    = document.getElementById("auth-status");
const gsiMount    = document.getElementById("gsi-button");
const fallbackBtn = document.getElementById("fallback-signin");

// ── Session ──
function saveSession(token, user) {
  localStorage.setItem("imhotep_token", token);
  localStorage.setItem("imhotep_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("imhotep_token");
  localStorage.removeItem("imhotep_user");
}
function getToken() { return localStorage.getItem("imhotep_token"); }
function getUser() {
  try { return JSON.parse(localStorage.getItem("imhotep_user") || "null"); }
  catch (e) { return null; }
}

function showChat(user) {
  if (authGate) authGate.classList.add("hidden");
  if (chatSec)  chatSec.classList.remove("hidden");
  if (userNameEl) userNameEl.textContent = user.name || user.email || "user";
}
function showGate() {
  if (chatSec)  chatSec.classList.add("hidden");
  if (authGate) authGate.classList.remove("hidden");
}

// ── Google sign-in ──
async function handleCredentialResponse(response) {
  if (!response || !response.credential) {
    if (authStat) authStat.textContent = "Sign-in failed.";
    return;
  }
  if (authStat) authStat.textContent = "Verifying…";
  try {
    const r = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "Invalid token");
    saveSession(data.token, data.user);
    showChat(data.user);
  } catch (e) {
    if (authStat) authStat.textContent = "Verification failed: " + e.message;
  }
}
window.handleCredentialResponse = handleCredentialResponse;

function initGoogleSignIn() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    initGoogleSignIn.tries = (initGoogleSignIn.tries || 0) + 1;
    if (initGoogleSignIn.tries < 20) return setTimeout(initGoogleSignIn, 300);
    if (fallbackBtn) fallbackBtn.classList.remove("hidden");
    if (authStat) authStat.textContent = "Google sign-in unavailable.";
    return;
  }
  try {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
    });
    if (gsiMount) {
      google.accounts.id.renderButton(gsiMount, {
        type: "standard", size: "large", theme: "filled_black",
        text: "signin_with", shape: "pill", logo_alignment: "left", width: 280,
      });
    }
  } catch (e) {
    console.error("GSI init error:", e);
    if (authStat) authStat.textContent = "Init error: " + e.message;
  }
}

if (fallbackBtn) {
  fallbackBtn.addEventListener("click", () => {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.prompt();
    } else {
      alert("Google sign-in unavailable.");
    }
  });
}

// ── Email / password ──
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    document.getElementById("signin-form").classList.toggle("hidden", which !== "signin");
    document.getElementById("signup-form").classList.toggle("hidden", which !== "signup");
  });
});

const signinForm = document.getElementById("signin-form");
if (signinForm) {
  signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("si-email").value.trim();
    const password = document.getElementById("si-password").value;
    if (authStat) authStat.textContent = "Signing in…";
    try {
      const r = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      saveSession(data.token, data.user);
      showChat(data.user);
    } catch (e) {
      if (authStat) authStat.textContent = "Error: " + e.message;
    }
  });
}

const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("su-name").value.trim();
    const email = document.getElementById("su-email").value.trim();
    const password = document.getElementById("su-password").value;
    if (authStat) authStat.textContent = "Creating account…";
    try {
      const r = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      saveSession(data.token, data.user);
      showChat(data.user);
    } catch (e) {
      if (authStat) authStat.textContent = "Error: " + e.message;
    }
  });
}

function signOut() {
  clearSession();
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  showGate();
  if (authStat) authStat.textContent = "";
}
if (signoutBtn) signoutBtn.addEventListener("click", signOut);

window.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (user && getToken()) showChat(user);
  initGoogleSignIn();
});

// ── Chat ──
function addMsg(role, text) {
  if (!messagesEl) return;
  const div = document.createElement("div");
  div.className = role === "user" ? "u" : "a";
  div.textContent = (role === "user" ? "You: " : "Imhotep: ") + text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const prompt = promptIn.value.trim();
    if (!prompt) return;
    const user = getUser() || {};
    promptIn.value = "";
    promptIn.disabled = true;
    sendBtn.disabled = true;
    addMsg("user", prompt);
    if (statusEl) statusEl.textContent = "Thinking…";
    try {
      const r = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, user_id: user.email || "guest" }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      addMsg("assistant", data.reply || "(no reply)");
      if (statusEl) statusEl.textContent = `${data.source || "?"} · ${data.took_ms || 0} ms`;
    } catch (err) {
      addMsg("assistant", "⚠️ " + err.message);
      if (statusEl) statusEl.textContent = "error";
    } finally {
      promptIn.disabled = false;
      sendBtn.disabled = false;
      promptIn.focus();
    }
  });
}

// ── Debate ──
const debateBtn   = document.getElementById("debate-btn");
const debateTopic = document.getElementById("debate-topic");
const debateOut   = document.getElementById("debate-output");
const proText     = document.getElementById("pro-text");
const oppText     = document.getElementById("opp-text");
const judgeText   = document.getElementById("judge-text");
const debateStat  = document.getElementById("debate-status");

if (debateBtn) {
  debateBtn.addEventListener("click", async () => {
    const topic = (debateTopic.value || "").trim();
    if (!topic) return;
    debateBtn.disabled = true;
    if (debateStat) debateStat.textContent = "Agents are arguing…";
    if (debateOut) debateOut.classList.remove("hidden");
    if (proText)   proText.textContent = "…";
    if (oppText)   oppText.textContent = "…";
    if (judgeText) judgeText.textContent = "…";
    try {
      const r = await fetch(`${API_URL}/debate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (proText)   proText.textContent   = data.proponent || "…";
      if (oppText)   oppText.textContent   = data.opponent  || "…";
      if (judgeText) judgeText.textContent = data.judge     || "…";
      if (debateStat) debateStat.textContent = `done · ${data.took_ms || 0} ms`;
    } catch (e) {
      if (debateStat) debateStat.textContent = "error: " + e.message;
    } finally {
      debateBtn.disabled = false;
    }
  });
}
