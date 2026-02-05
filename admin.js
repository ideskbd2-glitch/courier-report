// admin.js (ES Module)
// Firebase v9 modular via CDN

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

/* =========================
   YOUR CONFIG + MASTER EMAIL
========================= */
const firebaseConfig = {
  apiKey: "AIzaSyBoInYELD9MbXamDyQPN_OSyVBaFMouSLA",
  authDomain: "courier-report-199b7.firebaseapp.com",
  projectId: "courier-report-199b7",
  storageBucket: "courier-report-199b7.firebasestorage.app",
  messagingSenderId: "985913257751",
  appId: "1:985913257751:web:1e4164beca2a945da11152",
  measurementId: "G-RZPRWQP9G2"
};

const MASTER_EMAIL = "ebadot.hossen@carrybee.com";

/* =========================
   INIT
========================= */
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e) { /* analytics may fail on non-https */ }

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* =========================
   UI HELPERS
========================= */
const $ = (id) => document.getElementById(id);

const ui = {
  alert: $("alert"),
  btnLogin: $("btnLogin"),
  btnLogout: $("btnLogout"),
  userChip: $("userChip"),
  userName: $("userName"),
  userEmail: $("userEmail"),
  avatar: $("avatar"),

  app: $("app"),
  envPill: $("envPill"),
  rolePill: $("rolePill"),
  statusPill: $("statusPill"),
  todayLabel: $("todayLabel"),

  // tabs
  tabs: document.querySelectorAll(".tab"),
  panels: {
    upload: $("panel-upload"),
    visitors: $("panel-visitors"),
    zones: $("panel-zones"),
    admins: $("panel-admins"),
  },
  tabZones: $("tabZones"),
  tabAdmins: $("tabAdmins"),

  // upload
  reportDate: $("reportDate"),
  zoneSelect: $("zoneSelect"),
  fileMorning: $("fileMorning"),
  fileFinal: $("fileFinal"),
  btnUploadMorning: $("btnUploadMorning"),
  btnUploadFinal: $("btnUploadFinal"),
  progressWrap: $("progressWrap"),
  progressBar: $("progressBar"),
  progressText: $("progressText"),
  recentTbody: $("recentTbody"),
  recentCount: $("recentCount"),

  // zones
  newZoneName: $("newZoneName"),
  btnAddZone: $("btnAddZone"),
  zoneTbody: $("zoneTbody"),

  // admins
  newAdminEmail: $("newAdminEmail"),
  btnAddAdmin: $("btnAddAdmin"),
  adminTbody: $("adminTbody"),

  // visitors
  btnRefreshVisitors: $("btnRefreshVisitors"),
  visitorTbody: $("visitorTbody"),
  visitorCount: $("visitorCount"),
  visitorChips: document.querySelectorAll(".chip"),
};

function showAlert(type, msg) {
  ui.alert.className = `alert ${type}`;
  ui.alert.textContent = msg;
  ui.alert.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function hideAlert(){ ui.alert.classList.add("hidden"); }

function setLoading(btn, isLoading, text = "Loading...") {
  if (!btn) return;
  btn.disabled = isLoading;
  btn.dataset._oldText ??= btn.textContent;
  btn.textContent = isLoading ? text : btn.dataset._oldText;
}

function escapeHtml(s="") {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* =========================
   DATE (Dhaka) — Today Only
========================= */
function getTodayDhakaISO() {
  // YYYY-MM-DD in Asia/Dhaka
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
}

/* =========================
   AUTH + ROLE
========================= */
let me = {
  uid: null,
  email: null,
  name: null,
  role: null,   // "master" | "admin"
  active: false
};

async function resolveRole(user) {
  const email = (user.email || "").toLowerCase();

  if (email === MASTER_EMAIL.toLowerCase()) {
    return { role: "master", active: true };
  }

  // admins collection: docs keyed by uid for convenience
  // but we support lookup by email too
  const adminsRef = collection(db, "admins");
  const qy = query(adminsRef, where("email", "==", email), limit(1));
  const snap = await getDocs(qy);
  if (snap.empty) return { role: null, active: false };

  const d = snap.docs[0].data();
  if (d.active === false) return { role: d.role || "admin", active: false };
  return { role: d.role || "admin", active: true };
}

function applyRoleUI() {
  ui.rolePill.textContent = me.role ? (me.role === "master" ? "Master Admin" : "Regular Admin") : "No Access";
  ui.statusPill.textContent = me.active ? "Active" : "Blocked";
  ui.statusPill.className = `pill ${me.active ? "ghost" : ""}`;

  // Master-only tabs
  const isMaster = me.role === "master" && me.active;
  ui.tabZones.classList.toggle("hidden", !isMaster);
  ui.tabAdmins.classList.toggle("hidden", !isMaster);

  // If currently on a hidden tab, jump to upload
  const activeTab = document.querySelector(".tab.active")?.dataset?.tab;
  if (!isMaster && (activeTab === "zones" || activeTab === "admins")) {
    switchTab("upload");
  }
}

function setAuthedUI(user) {
  ui.btnLogin.classList.add("hidden");
  ui.userChip.classList.remove("hidden");
  ui.app.classList.remove("hidden");

  ui.userName.textContent = user.displayName || "User";
  ui.userEmail.textContent = user.email || "—";
  ui.avatar.textContent = (user.displayName?.[0] || user.email?.[0] || "U").toUpperCase();
}

function setLoggedOutUI() {
  ui.btnLogin.classList.remove("hidden");
  ui.userChip.classList.add("hidden");
  ui.app.classList.add("hidden");
  ui.rolePill.textContent = "—";
  ui.statusPill.textContent = "—";
}

/* =========================
   TABS
========================= */
function switchTab(name) {
  ui.tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  Object.entries(ui.panels).forEach(([k, el]) => {
    el.classList.toggle("active", k === name);
  });
}

/* =========================
   DATA: ZONES
========================= */
let unsubscribeZones = null;

function renderZoneOptions(zones) {
  ui.zoneSelect.innerHTML = "";
  if (!zones.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No zones (Master admin add zone)";
    ui.zoneSelect.appendChild(opt);
    return;
  }

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Zone সিলেক্ট করুন";
  ui.zoneSelect.appendChild(placeholder);

  zones.forEach(z => {
    const opt = document.createElement("option");
    opt.value = z.id;
    opt.textContent = z.name + (z.active === false ? " (inactive)" : "");
    opt.disabled = (z.active === false);
    ui.zoneSelect.appendChild(opt);
  });
}

function renderZoneTable(zones) {
  if (!zones.length) {
    ui.zoneTbody.innerHTML = `<tr><td colspan="4" class="muted">কোনো zone নেই</td></tr>`;
    return;
  }

  ui.zoneTbody.innerHTML = zones.map(z => {
    const created = z.createdAt?.toDate ? z.createdAt.toDate().toLocaleString() : "—";
    const statusBadge = z.active === false
      ? `<span class="badge bad">inactive</span>`
      : `<span class="badge ok">active</span>`;

    return `
      <tr>
        <td>
          <div style="display:flex;gap:8px;align-items:center;">
            <input class="input" style="max-width:320px;" value="${escapeHtml(z.name)}" data-zone-name="${z.id}" />
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>${escapeHtml(created)}</td>
        <td style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" data-zone-save="${z.id}">Save</button>
          <button class="btn" data-zone-toggle="${z.id}">
            ${z.active === false ? "Activate" : "Deactivate"}
          </button>
          <button class="btn danger" data-zone-delete="${z.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function watchZones() {
  const zonesRef = collection(db, "zones");
  const qy = query(zonesRef, orderBy("createdAt", "desc"));
  if (unsubscribeZones) unsubscribeZones();

  unsubscribeZones = onSnapshot(qy, (snap) => {
    const zones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // dropdown: only show all (but disable inactive); in table show all
    renderZoneOptions(zones);
    if (me.role === "master") renderZoneTable(zones);
  });
}

async function addZone() {
  const name = (ui.newZoneName.value || "").trim();
  if (!name) return showAlert("warn", "Zone নাম দিন।");
  setLoading(ui.btnAddZone, true);

  try {
    await addDoc(collection(db, "zones"), {
      name,
      active: true,
      createdAt: serverTimestamp(),
      createdBy: me.email || null
    });
    ui.newZoneName.value = "";
    showAlert("ok", "Zone যোগ হয়েছে।");
  } catch (e) {
    showAlert("bad", `Zone add failed: ${e.message}`);
  } finally {
    setLoading(ui.btnAddZone, false);
  }
}

async function saveZoneName(zoneId) {
  const input = document.querySelector(`[data-zone-name="${zoneId}"]`);
  const name = (input?.value || "").trim();
  if (!name) return showAlert("warn", "Zone নাম ফাঁকা রাখা যাবে না।");

  try {
    await updateDoc(doc(db, "zones", zoneId), { name, updatedAt: serverTimestamp() });
    showAlert("ok", "Zone update হয়েছে।");
  } catch (e) {
    showAlert("bad", `Zone update failed: ${e.message}`);
  }
}

async function toggleZone(zoneId) {
  try {
    const snap = await getDoc(doc(db, "zones", zoneId));
    if (!snap.exists()) return;
    const cur = snap.data().active !== false;
    await updateDoc(doc(db, "zones", zoneId), { active: !cur, updatedAt: serverTimestamp() });
    showAlert("ok", `Zone ${cur ? "deactivate" : "activate"} হয়েছে।`);
  } catch (e) {
    showAlert("bad", `Zone toggle failed: ${e.message}`);
  }
}

async function deleteZone(zoneId) {
  if (!confirm("আপনি কি নিশ্চিত? Zone স্থায়ীভাবে Delete হবে।")) return;
  try {
    await deleteDoc(doc(db, "zones", zoneId));
    showAlert("ok", "Zone delete হয়েছে।");
  } catch (e) {
    showAlert("bad", `Zone delete failed: ${e.message}`);
  }
}

/* =========================
   DATA: ADMINS (MASTER ONLY)
========================= */
let unsubscribeAdmins = null;

function renderAdminTable(admins) {
  if (!admins.length) {
    ui.adminTbody.innerHTML = `<tr><td colspan="5" class="muted">কোনো admin নেই</td></tr>`;
    return;
  }

  ui.adminTbody.innerHTML = admins.map(a => {
    const created = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString() : "—";
    const status = a.active === false
      ? `<span class="badge bad">blocked</span>`
      : `<span class="badge ok">active</span>`;
    const role = a.role === "master" ? "master" : "admin";

    return `
      <tr>
        <td>${escapeHtml(a.email || "—")}</td>
        <td><span class="badge warn">${escapeHtml(role)}</span></td>
        <td>${status}</td>
        <td>${escapeHtml(created)}</td>
        <td style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn" data-admin-toggle="${a.id}">
            ${a.active === false ? "Activate" : "Block"}
          </button>
          <button class="btn danger" data-admin-delete="${a.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

function watchAdmins() {
  if (unsubscribeAdmins) unsubscribeAdmins();
  const adminsRef = collection(db, "admins");
  const qy = query(adminsRef, orderBy("createdAt", "desc"));
  unsubscribeAdmins = onSnapshot(qy, (snap) => {
    const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminTable(admins);
  });
}

async function addAdminByEmail() {
  const email = (ui.newAdminEmail.value || "").trim().toLowerCase();
  if (!email) return showAlert("warn", "Admin Gmail দিন।");
  if (!email.includes("@")) return showAlert("warn", "Valid Gmail/Email দিন।");
  if (email === MASTER_EMAIL.toLowerCase()) return showAlert("warn", "Master email কে Regular admin করা যাবে না।");

  setLoading(ui.btnAddAdmin, true);
  try {
    // Use email as docId for uniqueness
    await setDoc(doc(db, "admins", email), {
      email,
      role: "admin",
      active: true,
      createdAt: serverTimestamp(),
      createdBy: me.email || null
    }, { merge: true });

    ui.newAdminEmail.value = "";
    showAlert("ok", "Regular admin যোগ হয়েছে।");
  } catch (e) {
    showAlert("bad", `Admin add failed: ${e.message}`);
  } finally {
    setLoading(ui.btnAddAdmin, false);
  }
}

async function toggleAdmin(adminId) {
  try {
    const refDoc = doc(db, "admins", adminId);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) return;
    const cur = snap.data().active !== false;
    await updateDoc(refDoc, { active: !cur, updatedAt: serverTimestamp() });
    showAlert("ok", `Admin ${cur ? "blocked" : "activated"} হয়েছে।`);
  } catch (e) {
    showAlert("bad", `Admin toggle failed: ${e.message}`);
  }
}

async function deleteAdmin(adminId) {
  if (!confirm("আপনি কি নিশ্চিত? Admin স্থায়ীভাবে Delete হবে।")) return;
  try {
    await deleteDoc(doc(db, "admins", adminId));
    showAlert("ok", "Admin delete হয়েছে।");
  } catch (e) {
    showAlert("bad", `Admin delete failed: ${e.message}`);
  }
}

/* =========================
   DATA: VISITOR REQUESTS (ALL ADMINS)
========================= */
let visitorFilter = "pending";

function statusBadge(s) {
  if (s === "approved") return `<span class="badge ok">approved</span>`;
  if (s === "blocked") return `<span class="badge bad">blocked</span>`;
  return `<span class="badge warn">pending</span>`;
}

async function loadVisitorRequests() {
  ui.visitorTbody.innerHTML = `<tr><td colspan="6" class="muted">লোড হচ্ছে…</td></tr>`;
  try {
    let qy;
    const refCol = collection(db, "visitor_requests");

    if (visitorFilter === "all") {
      qy = query(refCol, orderBy("requestedAt", "desc"), limit(200));
    } else {
      qy = query(refCol, where("status", "==", visitorFilter), orderBy("requestedAt", "desc"), limit(200));
    }

    const snap = await getDocs(qy);
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    ui.visitorCount.textContent = String(rows.length);
    if (!rows.length) {
      ui.visitorTbody.innerHTML = `<tr><td colspan="6" class="muted">কোনো রিকোয়েস্ট নেই</td></tr>`;
      return;
    }

    ui.visitorTbody.innerHTML = rows.map(v => {
      const time = v.requestedAt?.toDate ? v.requestedAt.toDate().toLocaleString() : "—";
      const email = v.email || v.id || "—";
      const name = v.name || "—";
      const hub = v.hubName || "—";
      const st = v.status || "pending";

      const approveBtn = st !== "approved"
        ? `<button class="btn" data-visitor-approve="${escapeHtml(v.id)}">Approve</button>`
        : "";

      const blockBtn = st !== "blocked"
        ? `<button class="btn danger" data-visitor-block="${escapeHtml(v.id)}">Block</button>`
        : `<button class="btn" data-visitor-unblock="${escapeHtml(v.id)}">Unblock</button>`;

      return `
        <tr>
          <td>${escapeHtml(email)}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(hub)}</td>
          <td>${statusBadge(st)}</td>
          <td>${escapeHtml(time)}</td>
          <td style="display:flex;gap:8px;flex-wrap:wrap;">
            ${approveBtn}
            ${blockBtn}
          </td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    showAlert("bad", `Visitor requests load failed: ${e.message}`);
  }
}

async function setVisitorStatus(id, status) {
  try {
    await setDoc(doc(db, "visitor_requests", id), {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: me.email || null,
      ...(status === "approved" ? { approvedAt: serverTimestamp(), approvedBy: me.email || null } : {})
    }, { merge: true });

    showAlert("ok", `Visitor ${status} হয়েছে।`);
    await loadVisitorRequests();
  } catch (e) {
    showAlert("bad", `Visitor update failed: ${e.message}`);
  }
}

/* =========================
   UPLOADS
========================= */
let unsubscribeRecent = null;

function validateTodayDate() {
  const today = getTodayDhakaISO();
  const picked = ui.reportDate.value;
  if (!picked) return { ok: false, msg: "তারিখ সিলেক্ট করুন (শুধু আজ)।" };
  if (picked !== today) return { ok: false, msg: "শুধু আজকের তারিখে আপলোড করা যাবে।" };
  return { ok: true };
}

async function getZoneName(zoneId) {
  if (!zoneId) return null;
  const snap = await getDoc(doc(db, "zones", zoneId));
  return snap.exists() ? (snap.data().name || null) : null;
}

function resetProgress() {
  ui.progressWrap.classList.add("hidden");
  ui.progressBar.style.width = "0%";
  ui.progressText.textContent = "—";
}

function showProgress(pct, text) {
  ui.progressWrap.classList.remove("hidden");
  ui.progressBar.style.width = `${pct}%`;
  ui.progressText.textContent = text;
}

async function uploadFile(type) {
  hideAlert();

  if (!me.active) return showAlert("bad", "আপনার অ্যাক্সেস ব্লক করা আছে।");
  if (!(me.role === "master" || me.role === "admin")) return showAlert("bad", "আপনার অ্যাক্সেস নেই।");

  const dateCheck = validateTodayDate();
  if (!dateCheck.ok) return showAlert("warn", dateCheck.msg);

  const zoneId = ui.zoneSelect.value;
  if (!zoneId) return showAlert("warn", "Zone সিলেক্ট করুন।");

  const fileInput = type === "morning" ? ui.fileMorning : ui.fileFinal;
  const file = fileInput.files?.[0];
  if (!file) return showAlert("warn", "ফাইল সিলেক্ট করুন।");

  const extOk = /\.(csv|xlsx|xls)$/i.test(file.name);
  if (!extOk) return showAlert("warn", "শুধু CSV/Excel ফাইল আপলোড করা যাবে (.csv/.xlsx/.xls)।");

  const today = getTodayDhakaISO();
  const zoneName = await getZoneName(zoneId);

  // Storage path
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const stamp = Date.now();
  const path = `uploads/${today}/${zoneId}/${type}/${stamp}_${safeName}`;
  const storageRef = ref(storage, path);

  setLoading(type === "morning" ? ui.btnUploadMorning : ui.btnUploadFinal, true, "Uploading...");
  resetProgress();

  try {
    const task = uploadBytesResumable(storageRef, file);
    await new Promise((resolve, reject) => {
      task.on("state_changed", (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        showProgress(pct, `${pct}% আপলোড হচ্ছে...`);
      }, reject, resolve);
    });

    const fileUrl = await getDownloadURL(storageRef);

    await addDoc(collection(db, "uploads"), {
      type, // "morning" | "final"
      zoneId,
      zoneName: zoneName || null,
      reportDate: today,
      fileName: file.name,
      filePath: path,
      fileUrl,
      uploadedBy: me.email || null,
      uploaderUid: me.uid || null,
      uploaderRole: me.role || null,
      uploadedAt: serverTimestamp()
    });

    fileInput.value = "";
    showProgress(100, "আপলোড সম্পন্ন ✅");
    showAlert("ok", "ফাইল সফলভাবে আপলোড হয়েছে।");

  } catch (e) {
    showAlert("bad", `Upload failed: ${e.message}`);
    resetProgress();
  } finally {
    setLoading(type === "morning" ? ui.btnUploadMorning : ui.btnUploadFinal, false);
  }
}

function watchRecentUploads() {
  const today = getTodayDhakaISO();
  const refCol = collection(db, "uploads");
  const qy = query(refCol, where("reportDate", "==", today), orderBy("uploadedAt", "desc"), limit(20));

  if (unsubscribeRecent) unsubscribeRecent();
  unsubscribeRecent = onSnapshot(qy, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    ui.recentCount.textContent = String(rows.length);

    if (!rows.length) {
      ui.recentTbody.innerHTML = `<tr><td colspan="5" class="muted">এখনো কোনো আপলোড নেই</td></tr>`;
      return;
    }

    ui.recentTbody.innerHTML = rows.map(r => {
      const time = r.uploadedAt?.toDate ? r.uploadedAt.toDate().toLocaleTimeString() : "—";
      const typeBadge = r.type === "final"
        ? `<span class="badge warn">final</span>`
        : `<span class="badge ok">morning</span>`;
      const zone = r.zoneName || r.zoneId || "—";
      const file = r.fileUrl
        ? `<a href="${r.fileUrl}" target="_blank" rel="noopener">${escapeHtml(r.fileName || "file")}</a>`
        : escapeHtml(r.fileName || "—");
      const by = r.uploadedBy || "—";

      return `
        <tr>
          <td>${escapeHtml(time)}</td>
          <td>${typeBadge}</td>
          <td>${escapeHtml(zone)}</td>
          <td>${file}</td>
          <td>${escapeHtml(by)}</td>
        </tr>
      `;
    }).join("");
  });
}

/* =========================
   BOOTSTRAP
========================= */
function initStaticUI() {
  const today = getTodayDhakaISO();
  ui.todayLabel.textContent = today;

  // date locked to today
  ui.reportDate.value = today;
  ui.reportDate.min = today;
  ui.reportDate.max = today;
  ui.reportDate.disabled = true; // show but cannot change

  // tabs click
  ui.tabs.forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });

  // visitors filter chips
  ui.visitorChips.forEach(ch => {
    ch.addEventListener("click", async () => {
      ui.visitorChips.forEach(x => x.classList.remove("active"));
      ch.classList.add("active");
      visitorFilter = ch.dataset.filter;
      await loadVisitorRequests();
    });
  });

  // buttons
  ui.btnLogin.addEventListener("click", async () => {
    hideAlert();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      showAlert("bad", `Login failed: ${e.message}`);
    }
  });

  ui.btnLogout.addEventListener("click", async () => {
    hideAlert();
    try { await signOut(auth); } catch {}
  });

  ui.btnUploadMorning.addEventListener("click", () => uploadFile("morning"));
  ui.btnUploadFinal.addEventListener("click", () => uploadFile("final"));

  ui.btnAddZone.addEventListener("click", addZone);
  ui.btnAddAdmin.addEventListener("click", addAdminByEmail);

  ui.btnRefreshVisitors.addEventListener("click", loadVisitorRequests);

  // delegations: zones/admins/visitors actions
  document.body.addEventListener("click", async (ev) => {
    const t = ev.target;

    // zones
    const saveId = t.getAttribute?.("data-zone-save");
    if (saveId) return saveZoneName(saveId);

    const toggleId = t.getAttribute?.("data-zone-toggle");
    if (toggleId) return toggleZone(toggleId);

    const delId = t.getAttribute?.("data-zone-delete");
    if (delId) return deleteZone(delId);

    // admins
    const at = t.getAttribute?.("data-admin-toggle");
    if (at) return toggleAdmin(at);

    const ad = t.getAttribute?.("data-admin-delete");
    if (ad) return deleteAdmin(ad);

    // visitors
    const va = t.getAttribute?.("data-visitor-approve");
    if (va) return setVisitorStatus(va, "approved");

    const vb = t.getAttribute?.("data-visitor-block");
    if (vb) return setVisitorStatus(vb, "blocked");

    const vu = t.getAttribute?.("data-visitor-unblock");
    if (vu) return setVisitorStatus(vu, "approved");
  });
}

async function afterLogin(user) {
  const email = (user.email || "").toLowerCase();
  const name = user.displayName || "User";

  me.uid = user.uid;
  me.email = email;
  me.name = name;

  const { role, active } = await resolveRole(user);
  me.role = role;
  me.active = active;

  setAuthedUI(user);
  applyRoleUI();

  // if no access: sign out
  if (!me.role) {
    showAlert("bad", "এই ইমেইলের জন্য অ্যাক্সেস নেই। Master Admin থেকে Regular Admin হিসেবে যোগ করুন।");
    await signOut(auth);
    return;
  }
  if (!me.active) {
    showAlert("bad", "আপনার অ্যাক্সেস ব্লক করা আছে।");
    await signOut(auth);
    return;
  }

  // show tabs based on role already handled
  switchTab("upload");

  // watchers
  watchZones();
  watchRecentUploads();

  // master-only watchers
  if (me.role === "master") {
    watchAdmins();
  } else {
    if (unsubscribeAdmins) { unsubscribeAdmins(); unsubscribeAdmins = null; }
  }

  // visitors tab is for all admins
  await loadVisitorRequests();

  showAlert("ok", `লগইন সফল ✅ (${me.role === "master" ? "Master Admin" : "Regular Admin"})`);
}

function onLogoutCleanup() {
  me = { uid:null, email:null, name:null, role:null, active:false };
  setLoggedOutUI();
  resetProgress();
  ui.zoneSelect.innerHTML = `<option value="">Zone সিলেক্ট করুন</option>`;
  ui.recentTbody.innerHTML = `<tr><td colspan="5" class="muted">এখনো কোনো আপলোড নেই</td></tr>`;
  ui.zoneTbody.innerHTML = `<tr><td colspan="4" class="muted">লোড হয়নি</td></tr>`;
  ui.adminTbody.innerHTML = `<tr><td colspan="5" class="muted">লোড হয়নি</td></tr>`;
  ui.visitorTbody.innerHTML = `<tr><td colspan="6" class="muted">ডাটা লোড হয়নি</td></tr>`;

  if (unsubscribeZones) { unsubscribeZones(); unsubscribeZones = null; }
  if (unsubscribeAdmins) { unsubscribeAdmins(); unsubscribeAdmins = null; }
  if (unsubscribeRecent) { unsubscribeRecent(); unsubscribeRecent = null; }
}

initStaticUI();

onAuthStateChanged(auth, async (user) => {
  hideAlert();
  if (!user) return onLogoutCleanup();
  try {
    await afterLogin(user);
  } catch (e) {
    showAlert("bad", `Init failed: ${e.message}`);
    try { await signOut(auth); } catch {}
  }
});
