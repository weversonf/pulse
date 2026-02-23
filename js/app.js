/**
 * PULSE OS - Central Intelligence v11.5 (Personal Edition)
 * Gestão Pessoal: Saúde, Finanças e Veículo.
 * Sincronização em Tempo Real via Firebase & Identidade Google.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
    apiKey: "SUA_API_AQUI",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_BUCKET",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ------------------------------------------------------------
// 🔥 ESTADO GLOBAL
// ------------------------------------------------------------

window.appState = window.appState || {
    perfil: {},
    veiculo: {},
    calibragem: {},
    tarefas: [],
    transacoes: [],
    water_ml: 0,
    energy_mg: 0,
    sidebarCollapsed: false
};

// ------------------------------------------------------------
// 🔔 TOAST
// ------------------------------------------------------------

window.showToast = (msg, type = "success") => {
    console.log(`[${type.toUpperCase()}] ${msg}`);
};

// ------------------------------------------------------------
// 🔐 AUTH
// ------------------------------------------------------------

onAuthStateChanged(auth, (user) => {
    if (user) {
        setupRealtimeSync(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// ------------------------------------------------------------
// 🔄 FIRESTORE REALTIME
// ------------------------------------------------------------

const setupRealtimeSync = (uid) => {
    const ref = doc(db, "users", uid);

    onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            window.appState = { ...window.appState, ...snap.data() };
            updateGlobalUI();
        } else {
            setDoc(ref, window.appState);
        }
    });
};

const pushState = async () => {
    if (!auth.currentUser) return false;
    const ref = doc(db, "users", auth.currentUser.uid);

    try {
        await setDoc(ref, window.appState);
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
};

// ------------------------------------------------------------
// 🧠 UPDATE GLOBAL UI
// ------------------------------------------------------------

const updateGlobalUI = () => {

    // Atualiza valores gerais se existirem
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    set('dash-water-cur', window.appState.water_ml || 0);
    set('dash-energy-val', window.appState.energy_mg || 0);

    // 🔥 AQUI ESTÁ O AJUSTE IMPORTANTE
    if (typeof window.fillAjustesForm === 'function') {
        window.fillAjustesForm();
    }

};

// ------------------------------------------------------------
// ⚙️ SALVAR AJUSTES
// ------------------------------------------------------------

window.savePulseSettings = async () => {

    if (document.getElementById('set-bike-km')) {
        window.appState.veiculo.km =
            parseInt(document.getElementById('set-bike-km').value) || 0;
    }

    if (document.getElementById('set-peso')) {
        window.appState.perfil.peso =
            parseFloat(document.getElementById('set-peso').value) || 0;
    }

    const ok = await pushState();

    if (ok) {
        window.showToast("Dados salvos!");
        updateGlobalUI();
    }
};

// ------------------------------------------------------------
// 🧭 NAVEGAÇÃO
// ------------------------------------------------------------

window.openTab = (page) => {
    window.location.href = page + ".html";
};

// ------------------------------------------------------------
// 🧪 INIT
// ------------------------------------------------------------

updateGlobalUI();