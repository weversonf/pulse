// =============================
// FIREBASE IMPORTS (CDN v12)
// =============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// =============================
// CONFIG FIREBASE (SEU PROJETO)
// =============================
const firebaseConfig = {
  apiKey: "AIzaSyAyqPiFoq6s7L6J3pPeCG-ib66H8mueoZs",
  authDomain: "pulse-68c1c.firebaseapp.com",
  projectId: "pulse-68c1c",
  storageBucket: "pulse-68c1c.firebasestorage.app",
  messagingSenderId: "360386380741",
  appId: "1:360386380741:web:d45af208f595b5799a81ac"
};

// =============================
// INIT FIREBASE
// =============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let userData = {};

// =============================
// AUTH STATE
// =============================
document.addEventListener("DOMContentLoaded", () => {

  onAuthStateChanged(auth, async (user) => {

    const page = window.location.pathname.split("/").pop();

    // Se não estiver logado
    if (!user) {
      if (page !== "index.html" && page !== "") {
        window.location.href = "./index.html";
      }
      return;
    }

    // Se estiver logado e ainda estiver no index
    if (user && (page === "index.html" || page === "")) {
      window.location.href = "./dashboard.html";
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
window.loginWithGoogle = async function () {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = "./dashboard.html";
  } catch (error) {
    alert("Erro ao logar: " + error.message);
  }
};

// =============================
// LOGIN EMAIL (placeholder)
// =============================
window.loginWithEmail = async function () {
  return { success: false, error: "Login por email não configurado" };
};

// =============================
// LOGOUT
// =============================
window.logout = async function () {
  await signOut(auth);
  window.location.href = "./index.html";
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

  onSnapshot(ref, (docSnap) => {
    userData = docSnap.data() || {};
  });
}

// =============================
// MENU DINÂMICO (CORRIGIDO)
// =============================
function injectMenu() {

  const container = document.getElementById("sidebar-placeholder");
  if (!container) return;

  container.innerHTML = `
    <div class="fixed left-0 top-0 h-full w-64 bg-slate-900 border-r border-white/5 p-6 space-y-4 z-50">
      <h2 class="text-xl font-black text-blue-500">PULSE</h2>
      <nav class="flex flex-col gap-3 text-sm">
        <a href="./dashboard.html">Dashboard</a>
        <a href="./perfil.html">Perfil</a>
        <a href="./financas.html">Finanças</a>
        <a href="./veiculo.html">Veículo</a>
        <a href="./work.html">Work</a>
        <a href="./ajustes.html">Ajustes</a>
        <button onclick="logout()" class="text-red-500 mt-4 text-left">Sair</button>
      </nav>
    </div>
  `;
}

// =============================
// CARREGAR PÁGINA
// =============================
function loadPageData() {

  const page = window.location.pathname.split("/").pop();

  if (page === "dashboard.html") renderDashboard();
}

// =============================
// DASHBOARD
// =============================
function renderDashboard() {

  const el = document.getElementById("dashboard-content");
  if (!el) return;

  el.innerHTML = `
    <h2 class="text-2xl font-bold">
      Bem-vindo, ${currentUser.displayName || "Usuário"}
    </h2>
  `;
}