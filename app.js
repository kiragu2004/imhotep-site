// ═══════════════════════════════════════════════════════════════
// Imhotep frontend — explicit Google Sign-In
// ═══════════════════════════════════════════════════════════════
const API_URL = window.IMHOTEP_CONFIG.API_URL;
const CLIENT_ID = window.IMHOTEP_CONFIG.GOOGLE_CLIENT_ID;

const gate        = document.getElementById("signin-gate");
const chatSec     = document.getElementById("chat");
const userNameEl  = document.getElementById("user-name");
const messagesEl  = document.getElementById("messages");
const form        = document.getElementById("chat-form");
const promptIn    = document.getElementById("prompt");
const sendBtn     = document.getElementById("send-btn");
const statusEl    = document.getElementById("status");
const signoutBtn  = document.getElementById("signout-btn");
const signinStat  = document.getElementById("signin-status");
const gsiMount    = document.getElementById("gsi-button");
const fallbackBtn = document.getElementById("fallback-signin");

// ── Called by Google after sign-in ──
async function handleCredentialResponse(response) {
  if (!response || !response.credential) {
    if (signinStat) signinStat.textContent = "Sign-in failed.";
    return;
  }
  if (signinStat) signinStat.textContent = "Verifying…";

  try {
    const r = await fetch(`${API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || "Invalid token");

    localStorage.setItem("imhotep_user", JSON.stringify(data.user));
    showChat(data.user);
  } catch (e) {
    if (signinStat) signinStat.textContent = "Verification failed: " + e.message;
  }
}
window.handleCredentialResponse = handleCredentialResponse;

function showChat(user) {
  if (gate) gate.classList.add("hidden");
  if (chatSec) chatSec.classList.remove("hidden");
  if (userNameEl) userNameEl.textContent = user.name || user.email || "user";
}

function signOut() {
  localStorage.removeItem("imhotep_user");
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  if (chatSec) chatSec.classList.add("hidden");
  if (gate) gate.classList.remove("hidden");
  if (signinStat) signinStat.textContent = "";
}
if (signoutBtn) signoutBtn.addEventListener("click", signOut);

// ── Initialize Google Sign-In when GIS script is ready ──
function initGoogleSignIn() {
  if (!window.google || !google.accounts || !google.accounts.id) {
    // GIS still loading — retry every 300 ms, up to 20 times (6 s)
    if (!initGoogleSignIn.tries) initGoogleSignIn.tries = 0;
    initGoogleSignIn.tries++;
    if (initGoogleSignIn.tries < 20) {
      setTimeout(initGoogleSignIn, 300);
      return;
    }
    // Gave up — show fallback
    console.warn("GSI failed to load. Showing fallback.");
    if (fallbackBtn) fallbackBtn.classList.remove("hidden");
    if (signinStat) signinStat.textContent = "Google sign-in unavailable.";
    return;
  }

  try {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    if (gsiMount) {
      google.accounts.id.renderButton(gsiMount, {
        type: "standard",
        size: "large",
        theme: "filled_black",
        text: "signin_with",
        shape: "pill",
        logo_alignment: "left",
        width: 280,
      });
    }
  } catch (e) {
    console.error("GSI init error:", e);
    if (signinStat) signinStat.textContent = "Sign-in init error: " + e.message;
  }
}

// Fallback button — if GSI never loads, use a manual trigger
if (fallbackBtn) {
  fallbackBtn.addEventListener("click", () => {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.prompt();
    } else {
      alert("Google sign-in is not available. Check your network and reload.");
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Restore session if any
  const raw = localStorage.getItem("imhotep_user");
  if (raw) {
    try { showChat(JSON.parse(raw)); } catch (e) { localStorage.removeItem("imhotep_user"); }
  }
  // Attempt to mount the Google button
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
    const user = JSON.parse(localStorage.getItem("imhotep_user") || "{}");
    promptIn.value = "";
    promptIn.disabled = true;
    sendBtn.disabled = true;
    addMsg("user", prompt);
    if (statusEl) statusEl.textContent = "Thinking…";
    try {
      const r = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, user_id: user.email || user.sub || "guest" }),
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
