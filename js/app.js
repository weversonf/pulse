/**
 * PULSE OS - Central Intelligence v11.6
 * Versão Estável Completa
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

// 🔥 CONFIG FIREBASE (SEU ORIGINAL)
const firebaseConfig = {
    apiKey: "AIzaSyAyqPiFoq6s7L6J3pPeCG-ib66H8mueoZs",
    authDomain: "pulse-68c1c.firebaseapp.com",
    projectId: "pulse-68c1c",
    storageBucket: "pulse-68c1c.firebasestorage.app",
    messagingSenderId: "360386380741",
    appId: "1:360386380741:web:d45af208f595b5799a81ac"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// --------------------------------------------------
// ESTADO GLOBAL
// --------------------------------------------------

window.appState = {
    login: "USUÁRIO",
    fullName: "USUÁRIO",
    photoURL: null,
    email: "",
    perfil: {},
    veiculo: {},
    calibragem: {},
    tarefas: [],
    transacoes: [],
    water_ml: 0,
    energy_mg: 0,
    sidebarCollapsed: false
};

// --------------------------------------------------
// LOGIN
// --------------------------------------------------

window.loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (error) {
        console.error(error);
        return { success: false };
    }
};

window.loginWithEmail = async (email, pass) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Falha na autenticação" };
    }
};

window.logout = async () => {
    await signOut(auth);
    window.location.href = "index.html";
};

// --------------------------------------------------
// AUTH STATE
// --------------------------------------------------

onAuthStateChanged(auth, (user) => {

    const path = window.location.pathname;

    if (user) {

        window.appState.login = user.displayName
            ? user.displayName.split(' ')[0].toUpperCase()
            : "USUÁRIO";

        window.appState.fullName = user.displayName || "USUÁRIO";
        window.appState.photoURL = user.photoURL || null;
        window.appState.email = user.email;

        setupRealtimeSync(user.uid);

        if (path.endsWith("index.html") || path === "/" || path === "") {
            window.location.href = "dashboard.html";
        }

    } else {

        if (!path.endsWith("index.html") && path !== "/" && path !== "") {
            window.location.href = "index.html";
        }
    }
});

// --------------------------------------------------
// FIRESTORE REALTIME
// --------------------------------------------------

const setupRealtimeSync = (uid) => {

    const ref = doc(db, "users", uid);

    onSnapshot(ref, (snap) => {

        if (snap.exists()) {

            const cloudData = snap.data();

            window.appState = {
                ...window.appState,
                ...cloudData
            };

            updateGlobalUI();

        } else {
            setDoc(ref, window.appState);
        }

    }, (error) => {
        console.error("Erro Sync:", error);
    });
};

const pushState = async () => {

    if (!auth.currentUser) return false;

    const ref = doc(db, "users", auth.currentUser.uid);

    try {
        await setDoc(ref, window.appState);
        return true;
    } catch (e) {
        console.error("Erro ao salvar:", e);
        return false;
    }
};

// --------------------------------------------------
// UPDATE GLOBAL UI
// --------------------------------------------------

const updateGlobalUI = () => {

    // 🔥 ATUALIZA AJUSTES SE EXISTIR
    if (typeof window.fillAjustesForm === "function") {
        window.fillAjustesForm();
    }

};

// --------------------------------------------------
// SALVAR AJUSTES
// --------------------------------------------------

window.savePulseSettings = async () => {

    let changed = false;

    if (document.getElementById('set-bike-km')) {
        window.appState.veiculo.km =
            parseInt(document.getElementById('set-bike-km').value) || 0;
        changed = true;
    }

    if (document.getElementById('set-peso')) {
        window.appState.perfil.peso =
            parseFloat(document.getElementById('set-peso').value) || 0;
        changed = true;
    }

    if (changed) {
        const ok = await pushState();
        if (ok) updateGlobalUI();
    }
};

// --------------------------------------------------

updateGlobalUI();