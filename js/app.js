/**
 * PULSE OS - Central Intelligence v15.1
 * Gestão Total: Saúde, Finanças e Veículo.
 * Sincronização em Tempo Real via Firebase & Google Auth.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithCustomToken, 
    signInAnonymously,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- CONFIGURAÇÃO MANUAL (COLA AS TUAS CHAVES DO FIREBASE AQUI PARA O GITHUB FUNCIONAR) ---
const MANUAL_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

// --- INICIALIZAÇÃO DO MOTOR ---
let app, auth, db;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pulse-os-personal-weverson';

try {
    // Tenta usar a config do ambiente ou a manual
    const envConfig = typeof __firebase_config !== 'undefined' ? (typeof __firebase_config === 'string' ? JSON.parse(__firebase_config) : __firebase_config) : null;
    const finalConfig = (envConfig && envConfig.apiKey) ? envConfig : MANUAL_CONFIG;
    
    if (finalConfig && finalConfig.apiKey) {
        app = initializeApp(finalConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } else {
        console.warn("Firebase: Aguardando configuração válida (apiKey ausente).");
    }
} catch (e) {
    console.error("Erro na inicialização do Firebase:", e);
}

// --- ESTADO GLOBAL (Sincronizado com os teus cards de 1.500,00) ---
window.appState = {
    login: "USUÁRIO", 
    fullName: "USUÁRIO", 
    sidebarCollapsed: false,
    perfil: { peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza', alcoholTitle: "ZERO ÁLCOOL", alcoholStart: "", alcoholTarget: 30 },
    veiculo: { tipo: 'Moto', km: 0, oleo: 38000, consumo: 29, montadora: "YAMAHA", modelo: "FAZER 250", historico: [], viagens: [] },
    calibragem: { monster_mg: 160, coffee_ml: 300 },
    tarefas: [], 
    transacoes: [],
    water_ml: 0,
    energy_mg: 0
};

// --- NOTIFICAÇÕES ---
window.showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all duration-500 flex items-center gap-3 border ${type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' : 'bg-red-950/90 border-red-500/50 text-red-400'}`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i> ${message}`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.remove(), 3500);
};

// --- LOGIN ---
window.loginWithGoogle = async () => {
    if (!auth) {
        window.showToast("Configuração de Nuvem ausente no ficheiro js/app.js", "error");
        return;
    }
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error("Erro Google Login:", error);
        window.showToast("Falha na autenticação Google", "error");
    }
};

window.loginWithEmail = async (email, password) => {
    if (!auth) return { success: false, error: "Firebase não configurado" };
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = "dashboard.html";
        return { success: true };
    } catch (error) {
        return { success: false, error: "Acesso Negado" };
    }
};

if (auth) {
    onAuthStateChanged(auth, (user) => {
        const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        if (user) {
            window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USUÁRIO";
            setupRealtimeSync(user.uid);
            if (isLoginPage) window.location.href = "dashboard.html";
        } else {
            if (!isLoginPage) window.location.href = "index.html";
        }
    });
}

// --- SINCRONIZAÇÃO ---
const setupRealtimeSync = (userId) => {
    if (!userId || !db) return;
    const stateDocRef = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    onSnapshot(stateDocRef, (snapshot) => {
        if (snapshot.exists()) {
            window.appState = { ...window.appState, ...snapshot.data() };
        } else {
            pushState();
        }
        updateGlobalUI();
    }, (error) => console.error("Sync Error:", error));
};

const pushState = async () => {
    if (!auth?.currentUser || !db) return;
    const userId = auth.currentUser.uid;
    const stateDocRef = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    const dataToSync = { ...window.appState };
    delete dataToSync.sidebarCollapsed; 
    try { await setDoc(stateDocRef, dataToSync, { merge: true }); return true; } catch (e) { return false; }
};

// --- INTERFACE (Ubuntu, Sem Itálico) ---
const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder') || document.getElementById('menu-container');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!sidebarPlaceholder) return;

    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'Tarefas', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Finanças', icon: 'wallet', color: 'text-emerald-500', sub: [ { label: 'Extrato', target: 'extrato' } ] },
        { id: 'ajustes', label: 'Ajustes', icon: 'settings', color: 'text-slate-400' }
    ];
    
    const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
    const isCollapsed = window.appState.sidebarCollapsed;

    sidebarPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 overflow-hidden" style="width: ${isCollapsed ? '5rem' : '16rem'}">
            <div class="p-6 flex items-center justify-between">
                <h1 class="text-2xl font-black text-blue-500 tracking-tighter ${isCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white mx-auto"><i data-lucide="menu" class="w-4 h-4"></i></button>
            </div>
            <nav class="flex-1 px-3 mt-4 space-y-1">
                ${items.map(i => {
                    const isActive = path === i.id || (i.sub && i.sub.some(s => path === s.target));
                    return `
                    <button onclick="${i.id === 'financas' ? `window.openTab('financas')` : (i.sub ? `window.toggleSubmenu('${i.id}')` : `window.openTab('${i.id}')`)}" 
                        class="w-full flex items-center justify-between px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${isActive ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'}">
                        <div class="flex items-center gap-4">
                            <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                            <span class="${isCollapsed ? 'hidden' : 'block'}">${i.label}</span>
                        </div>
                    </button>`;
                }).join('')}
            </nav>
        </aside>
    `;

    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-transparent sticky top-0 z-40 px-6 py-2 flex items-center justify-end">
                <button onclick="window.openTab('veiculo')" class="w-10 h-10 rounded-2xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-lg active:scale-95 transition-all">
                    <i data-lucide="fuel" class="w-5 h-5"></i>
                </button>
            </header>
        `;
    }
};

const updateGlobalUI = () => {
    injectInterface();
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    if (mainContent && window.innerWidth >= 768) mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
    if (typeof refreshDisplays === 'function') refreshDisplays();
    if (typeof renderFullExtrato === 'function') renderFullExtrato();
    if (window.lucide) lucide.createIcons();
};

// --- LOGICA FINANCEIRA ---
window.getProjectionData = (mode) => {
    const now = new Date();
    const trans = window.appState.transacoes || [];
    let count = mode === '2026' ? 12 : parseInt(mode);
    let startMonth = mode === '2026' ? 0 : now.getMonth();
    let startYear = mode === '2026' ? 2026 : now.getFullYear();

    const labels = [], income = [], expenses = [], balance = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        labels.push(d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase());
        const monthTrans = trans.filter(t => {
            if(!t.vencimento) return false;
            const tD = new Date(t.vencimento + "T12:00:00");
            return tD.getMonth() === d.getMonth() && tD.getFullYear() === d.getFullYear();
        });
        const incVal = monthTrans.filter(t => t.tipo === 'Receita').reduce((a, b) => a + b.valor, 0);
        const expVal = monthTrans.filter(t => t.tipo === 'Despesa').reduce((a, b) => a + b.valor, 0);
        income.push(incVal); expenses.push(expVal); balance.push(incVal - expVal);
    }
    return { labels, income, expenses, balance };
};

// --- ACÇÕES ---
window.processarLancamento = async (tipo) => {
    const val = parseFloat(document.getElementById('fin-valor').value);
    const venc = document.getElementById('fin-vencimento').value;
    if (isNaN(val) || !venc) return;
    window.appState.transacoes.push({ id: Date.now(), tipo: tipo === 'receita' ? 'Receita' : 'Despesa', desc: document.getElementById('fin-desc').value.toUpperCase(), valor: val, status: document.getElementById('fin-status').value, vencimento: venc, cat: "Geral", data: new Date().toLocaleDateString('pt-BR') });
    const ok = await pushState(); if (ok) { window.showToast("Lançamento Efetuado!"); updateGlobalUI(); }
};

window.saveBikeEntry = async () => {
    const desc = document.getElementById('bike-log-desc')?.value;
    const km = parseInt(document.getElementById('bike-log-km')?.value);
    if (!desc || isNaN(km)) return false;
    window.appState.veiculo.km = km;
    window.appState.veiculo.historico.push({ id: Date.now(), desc: desc.toUpperCase(), km, valor: parseFloat(document.getElementById('bike-log-valor')?.value) || 0, data: new Date().toLocaleDateString('pt-BR'), tipo: document.getElementById('bike-log-tipo')?.value || 'Manutenção' });
    const ok = await pushState(); if (ok) { window.showToast("Registro Salvo!"); updateGlobalUI(); return true; } 
    return false;
};

window.addWater = async (ml) => { window.appState.water_ml += ml; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast(`+${ml}ml Hidratado`); } };
window.addMonster = async () => { window.appState.energy_mg += window.appState.calibragem.monster_mg; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Energia Injetada!"); } };
window.resetHealthDay = async () => { window.appState.water_ml = 0; window.appState.energy_mg = 0; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Ciclo Zerado"); } };
window.toggleSidebar = () => { window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; updateGlobalUI(); };
window.openTab = (p) => { window.location.href = p + ".html"; };

document.addEventListener('DOMContentLoaded', () => { 
    updateGlobalUI(); 
    window.addEventListener('resize', updateGlobalUI); 
});
