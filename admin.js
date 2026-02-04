// Firebase v9 modular
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

/** =========================
 *  Firebase Config (আপনারটা)
 *  ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyBoInYELD9MbXamDyQPN_OSyVBaFMouSLA",
  authDomain: "courier-report-199b7.firebaseapp.com",
  projectId: "courier-report-199b7",
  storageBucket: "courier-report-199b7.firebasestorage.app",
  messagingSenderId: "985913257751",
  appId: "1:985913257751:web:1e4164beca2a945da11152",
  measurementId: "G-RZPRWQP9G2"
};

const MASTER_ADMIN_EMAIL = "ebadot.hossen@carrybee.com";

/** =========================
 *  Init
 *  ========================= */
const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (e) {}
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/** =========================
 *  DOM
 *  ========================= */
const el = (id) => document.getElementById(id);

const btnLogin = el("btnLogin");
const btnLogout = el("btnLogout");
const userCard = el("userCard");
const userName = el("userName");
const userEmail = el("userEmail");
const roleChip = el("roleChip");
const statusChip = el("statusChip");

const adminOnly = el("adminOnly");
const masterOnly = el("masterOnly");
const notAuthorized = el("notAuthorized");

const newAdminEmail = el("newAdminEmail");
const btnAddAdmin = el("btnAddAdmin");
const adminsTable = el("adminsTable");

const morningFile = el("morningFile");
const finalFile = el("finalFile");
const btnUploadMorning = el("btnUploadMorning");
const btnUploadFinal = el("btnUploadFinal");
const morningResult = el("morningResult");
const finalResult = el("finalResult");

const visitorsPending = el("visitorsPending");
const visitorsApproved = el("visitorsApproved");
const visitorsBlocked = el("visitorsBlocked");

/** =========================
 *  Helpers
 *  ========================= */
function safeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isMaster(email) {
  return safeEmail(email) === safeEmail(MASTER_ADMIN_EMAIL);
}

function isAllowedSheetOrCsv(file) {
  if (!file) return false;

  const name = (file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  const allowedExt = ["csv", "xlsx", "xls"];
  if (allowedExt.includes(ext)) return true;

  const allowedTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  return allowedTypes.has(file.type);
}

function setResult(node, msg, kind = "muted") {
  node.textContent = msg || "";
  node.style.color =
    kind === "ok" ? "var(--ok)" :
    kind === "danger" ? "var(--danger)" :
    kind === "warn" ? "var(--warn)" :
    "var(--muted)";
}

function renderTable(container, columns, rows) {
  if (!rows.length) {
    container.innerHTML = `<div class="hint">কোনো ডাটা নেই</div>`;
    return;
  }

  const thead = columns.map(c => `<th>${c.label}</th>`).join("");
  const tbody = rows.map(r => {
    const tds = columns.map(c => `<td>${c.render(r)}</td>`).join("");
    return `<tr>${tds}</tr>`;
  }).join("");

  container.innerHTML = `
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** =========================
 *  Auth UI
 *  ========================= */
btnLogin.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    alert(err?.message || "Login failed");
  }
});

btnLogout.addEventListener("click", async () => {
  await signOut(auth);
});

/** =========================
 *  Role/Access
 *  Firestore structure:
 *  admins/{emailLower} => { email, role: 'master'|'regular', status:'active'|'blocked', createdAt }
 *
 *  visitorRequests/{emailLower} => { email, name, hubName, status:'pending'|'approved'|'blocked', createdAt, approvedBy, approvedAt }
 *
 *  uploads/{autoId} => { type:'morning'|'final', fileName, fileExt, fileUrl, uploadedBy, uploadedAt }
 *  ========================= */
async function ensureMasterDocIfNeeded(email) {
  if (!isMaster(email)) return;

  const id = safeEmail(email);
  const refDoc = doc(db, "admins", id);
  const snap = await getDoc(refDoc);

  if (!snap.exists()) {
    await setDoc(refDoc, {
      email: id,
      role: "master",
      status: "active",
      createdAt: serverTimestamp()
    });
  } else {
    const d = snap.data();
    // Ensure master always active (optional)
    if (d.role !== "master" || d.status !== "active") {
      await updateDoc(refDoc, { role: "master", status: "active" });
    }
  }
}

async function getAdminProfile(email) {
  const id = safeEmail(email);
  const refDoc = doc(db, "admins", id);
  const snap = await getDoc(refDoc);
  if (!snap.exists()) return null;
  return snap.data();
}

function setUIForAuth(user, adminProfile) {
  if (!user) {
    userCard.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    btnLogout.classList.add("hidden");
    adminOnly.classList.add("hidden");
    masterOnly.classList.add("hidden");
    notAuthorized.classList.add("hidden");
    return;
  }

  userCard.classList.remove("hidden");
  btnLogin.classList.add("hidden");
  btnLogout.classList.remove("hidden");

  userName.textContent = user.displayName || "—";
  userEmail.textContent = user.email || "—";

  const role = adminProfile?.role || (isMaster(user.email) ? "master" : "—");
  const status = adminProfile?.status || "—";

  roleChip.textContent = role === "master" ? "MASTER ADMIN" : (role === "regular" ? "REGULAR ADMIN" : "UNKNOWN");
  statusChip.textContent = status.toUpperCase();

  // Access
  const isAdmin = !!adminProfile && adminProfile.status === "active";
  if (!isAdmin) {
    adminOnly.classList.add("hidden");
    masterOnly.classList.add("hidden");
    notAuthorized.classList.remove("hidden");
    return;
  }

  notAuthorized.classList.add("hidden");
  adminOnly.classList.remove("hidden");

  // Master-only section
  if (adminProfile.role === "master") masterOnly.classList.remove("hidden");
  else masterOnly.classList.add("hidden");
}

/** =========================
 *  Admin management (Master)
 *  ========================= */
btnAddAdmin?.addEventListener("click", async () => {
  const current = auth.currentUser;
  if (!current?.email) return;

  const me = await getAdminProfile(current.email);
  if (!me || me.role !== "master") {
    alert("শুধু Master Admin নতুন admin যোগ করতে পারবে।");
    return;
  }

  const email = safeEmail(newAdminEmail.value);
  if (!email || !email.includes("@")) {
    alert("Valid gmail দিন");
    return;
  }

  if (email === safeEmail(MASTER_ADMIN_EMAIL)) {
    alert("এইটা Master Admin email।");
    return;
  }

  try {
    await setDoc(doc(db, "admins", email), {
      email,
      role: "regular",
      status: "active",
      createdAt: serverTimestamp(),
      createdBy: safeEmail(current.email)
    }, { merge: true });

    newAdminEmail.value = "";
    alert("Admin যোগ হয়েছে!");
  } catch (err) {
    alert(err?.message || "Add admin failed");
  }
});

function listenAdminsTable(currentUserEmail) {
  const q = query(collection(db, "admins"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));

    renderTable(adminsTable, [
      { label: "Email", render: (r) => `<span class="badge">${escapeHtml(r.email)}</span>` },
      { label: "Role", render: (r) => escapeHtml(r.role || "") },
      { label: "Status", render: (r) => {
          const s = r.status || "";
          const emoji = s === "active" ? "🟢" : "⛔";
          return `${emoji} ${escapeHtml(s)}`;
        }
      },
      { label: "Action", render: (r) => {
          const me = safeEmail(currentUserEmail);
          const target = safeEmail(r.email);
          const disabled = (target === safeEmail(MASTER_ADMIN_EMAIL)) ? "disabled" : "";
          const nextStatus = r.status === "active" ? "blocked" : "active";
          const btnClass = r.status === "active" ? "btn btn-danger" : "btn btn-ok";
          const btnText = r.status === "active" ? "Block/Deactivate" : "Activate";

          return `
            <div class="row-actions">
              <button class="${btnClass}" data-admin-toggle="${escapeHtml(target)}" data-next="${escapeHtml(nextStatus)}" ${disabled}>
                ${btnText}
              </button>
            </div>
          `;
        }
      },
    ], rows);

    // attach handlers
    adminsTable.querySelectorAll("[data-admin-toggle]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const current = auth.currentUser;
        if (!current?.email) return;

        const meProfile = await getAdminProfile(current.email);
        if (!meProfile || meProfile.role !== "master") return;

        const targetEmail = btn.getAttribute("data-admin-toggle");
        const next = btn.getAttribute("data-next");

        try {
          await updateDoc(doc(db, "admins", targetEmail), {
            status: next,
            updatedAt: serverTimestamp(),
            updatedBy: safeEmail(current.email)
          });
        } catch (err) {
          alert(err?.message || "Update failed");
        }
      });
    });
  });
}

/** =========================
 *  Uploads (All Admins)
 *  ========================= */
async function uploadFile(type, file, resultNode) {
  const current = auth.currentUser;
  if (!current?.email) return;

  const me = await getAdminProfile(current.email);
  if (!me || me.status !== "active") {
    setResult(resultNode, "Admin access নেই", "danger");
    return;
  }

  if (!file) {
    setResult(resultNode, "ফাইল সিলেক্ট করুন", "warn");
    return;
  }

  if (!isAllowedSheetOrCsv(file)) {
    setResult(resultNode, "শুধু CSV/Excel (.csv, .xlsx, .xls) ফাইল আপলোড করা যাবে।", "danger");
    return;
  }

  const ext = (file.name || "").toLowerCase().split(".").pop();
  const ts = Date.now();
  const path = `uploads/${type}/${safeEmail(current.email)}/${ts}_${file.name}`;
  const storageRef = ref(storage, path);

  try {
    setResult(resultNode, "Uploading...", "warn");
    await uploadBytes(storageRef, file, { contentType: file.type || undefined });
    const url = await getDownloadURL(storageRef);

    await addDoc(collection(db, "uploads"), {
      type,
      fileName: file.name,
      fileExt: ext,
      filePath: path,
      fileUrl: url,
      uploadedBy: safeEmail(current.email),
      uploadedAt: serverTimestamp()
    });

    setResult(resultNode, `✅ Uploaded: ${file.name}`, "ok");
  } catch (err) {
    setResult(resultNode, err?.message || "Upload failed", "danger");
  }
}

btnUploadMorning.addEventListener("click", async () => {
  setResult(morningResult, "");
  await uploadFile("morning", morningFile.files[0], morningResult);
});

btnUploadFinal.addEventListener("click", async () => {
  setResult(finalResult, "");
  await uploadFile("final", finalFile.files[0], finalResult);
});

/** =========================
 *  Visitor Requests (All Admin)
 *  visitorRequests/{emailLower}
 *  ========================= */
function listenVisitorRequests() {
  const base = collection(db, "visitorRequests");

  const qp = query(base, where("status", "==", "pending"), orderBy("createdAt", "desc"));
  const qa = query(base, where("status", "==", "approved"), orderBy("approvedAt", "desc"));
  const qb = query(base, where("status", "==", "blocked"), orderBy("updatedAt", "desc"));

  const unsub1 = onSnapshot(qp, (snap) => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    renderVisitorTable(visitorsPending, rows, "pending");
  });

  const unsub2 = onSnapshot(qa, (snap) => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    renderVisitorTable(visitorsApproved, rows, "approved");
  });

  const unsub3 = onSnapshot(qb, (snap) => {
    const rows = [];
    snap.forEach(d => rows.push(d.data()));
    renderVisitorTable(visitorsBlocked, rows, "blocked");
  });

  return () => { unsub1(); unsub2(); unsub3(); };
}

function renderVisitorTable(container, rows, mode) {
  renderTable(container, [
    { label: "Email", render: (r) => `<span class="badge">${escapeHtml(r.email)}</span>` },
    { label: "Name", render: (r) => escapeHtml(r.name || "") },
    { label: "Hub", render: (r) => escapeHtml(r.hubName || "") },
    { label: "Status", render: (r) => escapeHtml(r.status || "") },
    { label: "Action", render: (r) => {
        const email = escapeHtml(safeEmail(r.email));
        const approveBtn = mode === "pending"
          ? `<button class="btn btn-ok" data-visitor-approve="${email}">Approve</button>`
          : "";
        const blockBtn = mode === "blocked"
          ? `<button class="btn btn-ok" data-visitor-unblock="${email}">Activate</button>`
          : `<button class="btn btn-danger" data-visitor-block="${email}">Block</button>`;

        return `<div class="row-actions">${approveBtn}${blockBtn}</div>`;
      }
    },
  ], rows);

  // actions
  container.querySelectorAll("[data-visitor-approve]").forEach(b => {
    b.addEventListener("click", async () => {
      await updateVisitorStatus(b.getAttribute("data-visitor-approve"), "approved");
    });
  });
  container.querySelectorAll("[data-visitor-block]").forEach(b => {
    b.addEventListener("click", async () => {
      await updateVisitorStatus(b.getAttribute("data-visitor-block"), "blocked");
    });
  });
  container.querySelectorAll("[data-visitor-unblock]").forEach(b => {
    b.addEventListener("click", async () => {
      await updateVisitorStatus(b.getAttribute("data-visitor-unblock"), "approved");
    });
  });
}

async function updateVisitorStatus(email, status) {
  const current = auth.currentUser;
  if (!current?.email) return;

  const me = await getAdminProfile(current.email);
  if (!me || me.status !== "active") {
    alert("Admin access নেই");
    return;
  }

  const id = safeEmail(email);
  const refDoc = doc(db, "visitorRequests", id);

  try {
    const payload = {
      status,
      updatedAt: serverTimestamp(),
      updatedBy: safeEmail(current.email),
    };
    if (status === "approved") {
      payload.approvedAt = serverTimestamp();
      payload.approvedBy = safeEmail(current.email);
    }
    await updateDoc(refDoc, payload);
  } catch (err) {
    alert(err?.message || "Update failed");
  }
}

/** =========================
 *  Tabs (Visitor)
 *  ========================= */
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");

    const tab = t.getAttribute("data-tab");
    visitorsPending.classList.toggle("hidden", tab !== "pending");
    visitorsApproved.classList.toggle("hidden", tab !== "approved");
    visitorsBlocked.classList.toggle("hidden", tab !== "blocked");
  });
});

/** =========================
 *  Boot
 *  ========================= */
let unsubAdmins = null;
let unsubVisitors = null;

onAuthStateChanged(auth, async (user) => {
  // cleanup listeners
  if (unsubAdmins) { unsubAdmins(); unsubAdmins = null; }
  if (unsubVisitors) { unsubVisitors(); unsubVisitors = null; }

  if (!user?.email) {
    setUIForAuth(null, null);
    return;
  }

  // Ensure master doc exists
  await ensureMasterDocIfNeeded(user.email);

  const profile = await getAdminProfile(user.email);

  setUIForAuth(user, profile);

  // If admin active, start listeners
  if (profile && profile.status === "active") {
    unsubVisitors = listenVisitorRequests();

    if (profile.role === "master") {
      unsubAdmins = listenAdminsTable(user.email);
    } else {
      adminsTable.innerHTML = "";
    }
  }
});
