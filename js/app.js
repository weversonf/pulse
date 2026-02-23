// =============================
// FIREBASE IMPORTS
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// =============================
// CONFIG FIREBASE
// =============================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// =============================
// INIT
// =============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let userData = {};

// =============================
// AGUARDAR DOM
// =============================
document.addEventListener("DOMContentLoaded", () => {

  onAuthStateChanged(auth, async (user) => {

    if (!user) {
      window.location.href = "index.html";
      return;
    }

    currentUser = user;
    await loadUserData();
    injectMenu();
    loadPageData();
  });

});

// =============================
// LOGIN GOOGLE
// =============================
window.loginGoogle = async function () {
  await signInWithPopup(auth, provider);
  window.location.href = "dashboard.html";
};

// =============================
// LOGOUT
// =============================
window.logout = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};

// =============================
// CARREGAR DADOS USUÁRIO
// =============================
async function loadUserData() {
  const ref = doc(db, "users", currentUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    userData = snap.data();
  } else {
    await setDoc(ref, {});
    userData = {};
  }

  // realtime
  onSnapshot(ref, (docSnap) => {
    userData = docSnap.data() || {};
  });
}

// =============================
// MENU DINÂMICO
// =============================
function injectMenu() {

  const container = document.getElementById("menu-container");
  if (!container) return;

  container.innerHTML = `
    <nav class="sidebar">
      <a href="dashboard.html">Dashboard</a>
      <a href="perfil.html">Perfil</a>
      <a href="financas.html">Finanças</a>
      <a href="veiculo.html">Veículo</a>
      <a href="work.html">Work</a>
      <a href="ajustes.html">Ajustes</a>
      <button onclick="logout()">Sair</button>
    </nav>
  `;
}

// =============================
// CARREGAR CONTEÚDO DA PÁGINA
// =============================
function loadPageData() {

  const page = window.location.pathname.split("/").pop();

  if (page === "dashboard.html") {
    renderDashboard();
  }

  if (page === "perfil.html") {
    fillForm("perfil-form");
  }

  if (page === "financas.html") {
    fillForm("financas-form");
  }

  if (page === "veiculo.html") {
    fillForm("veiculo-form");
  }

  if (page === "work.html") {
    fillForm("work-form");
  }

  if (page === "ajustes.html") {
    fillForm("ajustes-form");
  }
}

// =============================
// PREENCHER FORMULÁRIOS
// =============================
function fillForm(formId) {

  const form = document.getElementById(formId);
  if (!form) return;

  Object.keys(userData).forEach(key => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) field.value = userData[key];
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const obj = {};

    data.forEach((value, key) => {
      obj[key] = value;
    });

    await updateDoc(doc(db, "users", currentUser.uid), obj);
    alert("Salvo com sucesso!");
  });
}

// =============================
// DASHBOARD
// =============================
function renderDashboard() {
  const el = document.getElementById("dashboard-content");
  if (!el) return;

  el.innerHTML = `
    <h2>Bem-vindo, ${currentUser.displayName || "Usuário"}</h2>
  `;
}