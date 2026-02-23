/**
 * PULSE OS - Central Intelligence v14.0
 * Gestão Total: Saúde, Finanças e Veículo.
 * Sincronização em Tempo Real via Firebase & Google Auth.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

// --- CONFIGURAÇÃO FIREBASE ---
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
const appId = 'pulse-os-personal-weverson';

window.appState = {
    login: "USUÁRIO", fullName: "USUÁRIO", photoURL: null, email: "",
    energy_mg: 0, water_ml: 0, sidebarCollapsed: false,
    perfil: { peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza', alcoholTitle: "ZERO ÁLCOOL", alcoholStart: "", alcoholTarget: 30 },
    veiculo: { tipo: 'Moto', km: 0, oleo: 38000, consumo: 29, montadora: "YAMAHA", modelo: "FAZER 250", historico: [], viagens: [] },
    calibragem: { monster_mg: 160, coffee_ml: 300 },
    tarefas: [], transacoes: []
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

// --- AUTENTICAÇÃO ---
window.loginWithGoogle = async () => { try { await signInWithPopup(auth, googleProvider); } catch (err) { console.error(err); } };
window.logout = async () => { await signOut(auth); window.location.href = "index.html"; };

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USUÁRIO";
        window.appState.fullName = user.displayName;
        if(!window.appState.photoURL || !window.appState.photoURL.startsWith('ICON:')) window.appState.photoURL = user.photoURL;
        setupRealtimeSync(user.uid);
        updateGlobalUI(); 
    } else if (!window.location.pathname.endsWith('index.html')) window.location.href = "index.html";
});

// --- SINCRONIZAÇÃO ---
const setupRealtimeSync = (userId) => {
    const stateDoc = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    onSnapshot(stateDoc, (snapshot) => {
        if (snapshot.exists()) {
            const cloudData = snapshot.data();
            window.appState = { ...window.appState, ...cloudData };
            updateGlobalUI();
        } else pushState();
    });
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    const dataToSync = JSON.parse(JSON.stringify(window.appState));
    delete dataToSync.sidebarCollapsed; delete dataToSync.fullName; delete dataToSync.login;
    try { await setDoc(stateDoc, dataToSync, { merge: true }); return true; } catch (e) { return false; }
};

// --- SUBMENU DESKTOP ---
window.toggleSubmenu = (id) => {
    const sub = document.getElementById(`submenu-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    if (sub) {
        sub.classList.toggle('hidden');
        if (arrow) arrow.style.transform = sub.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)';
    }
};

// --- INTERFACE ---
const updateGlobalUI = () => {
    injectInterface();
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    if (sidebar) sidebar.style.width = isCollapsed ? '5rem' : '16rem';
    if (mainContent && window.innerWidth >= 768) mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';

    // Se houver uma função de refresh na página atual, executa
    if (typeof refreshDisplays === 'function') refreshDisplays();
    if (typeof renderFullExtrato === 'function') renderFullExtrato();

    if (window.lucide) lucide.createIcons();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!sidebarPlaceholder) return;

    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'Tarefas', icon: 'briefcase', color: 'text-sky-400' },
        { 
            id: 'financas', 
            label: 'Finanças', 
            icon: 'wallet', 
            color: 'text-emerald-500',
            sub: [
                { label: 'Resumo', target: 'financas' },
                { label: 'Extrato', target: 'extrato' }
            ]
        },
        { id: 'ajustes', label: 'Ajustes', icon: 'settings', color: 'text-slate-400' }
    ];
    
    const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];

    // Sidebar
    if (!sidebarPlaceholder.querySelector('aside')) {
        sidebarPlaceholder.innerHTML = `
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 tracking-tighter">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white"><i data-lucide="menu" class="w-4 h-4"></i></button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => `
                        <div>
                            <button onclick="${i.sub ? `window.toggleSubmenu('${i.id}')` : `window.openTab('${i.id}')`}" class="w-full flex items-center justify-between px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id || (i.sub && i.sub.some(s => path === s.target)) ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                                <div class="flex items-center gap-4">
                                    <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                                    <span class="menu-label">${i.label}</span>
                                </div>
                                ${i.sub ? `<i data-lucide="chevron-right" id="arrow-${i.id}" class="w-3 h-3 transition-transform"></i>` : ''}
                            </button>
                            ${i.sub ? `
                                <div id="submenu-${i.id}" class="${i.sub.some(s => path === s.target) ? '' : 'hidden'} pl-12 mt-1 space-y-1">
                                    ${i.sub.map(s => `<button onclick="window.openTab('${s.target}')" class="w-full text-left py-2 text-[9px] font-black uppercase tracking-widest ${path === s.target ? 'text-blue-500' : 'text-slate-500 hover:text-white'}">${s.label}</button>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </nav>
            </aside>
            <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 py-3 z-[100] shadow-2xl">
                ${items.filter(i => i.id !== 'ajustes').slice(0, 5).map(i => `<button onclick="window.openTab('${i.id}')" class="flex flex-col items-center gap-1 p-2 ${path === i.id || (i.sub && i.sub.some(s => path === s.target)) ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="${i.icon}" class="w-5 h-5"></i><span class="text-[7px] font-black uppercase">${i.label}</span></button>`).join('')}
                <button onclick="window.openTab('ajustes')" class="flex flex-col items-center gap-1 p-2 ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="settings" class="w-5 h-5"></i><span class="text-[7px] font-black uppercase">Ajustes</span></button>
            </nav>
        `;
    }

    // Header (Limpo conforme pedido, apenas com o ícone de abastecer)
    if (headerPlaceholder && !headerPlaceholder.querySelector('header')) {
        headerPlaceholder.innerHTML = `
            <header class="bg-transparent sticky top-0 z-40 px-6 py-6 flex items-center justify-end">
                <button onclick="window.openTab('veiculo')" class="w-12 h-12 rounded-2xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-lg active:scale-95 transition-all pointer-events-auto">
                    <i data-lucide="fuel" class="w-6 h-6"></i>
                </button>
            </header>
        `;
    }
};

// --- LOGICA FINANCEIRA (FILTROS DE PROJEÇÃO) ---
window.getProjectionData = (mode) => {
    const now = new Date();
    const trans = window.appState.transacoes || [];
    let count = 0;
    let startMonth = 0;
    let startYear = 2026;

    if (mode === '2026') {
        count = 12;
        startMonth = 0;
        startYear = 2026;
    } else {
        count = parseInt(mode);
        startMonth = now.getMonth();
        startYear = now.getFullYear();
    }

    const labels = [];
    const balance = [];

    for (let i = 0; i < count; i++) {
        const d = new Date(startYear, startMonth + i, 1);
        const mLabel = d.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
        labels.push(mLabel);

        // Calcula balanço do mês
        const monthVal = trans.filter(t => {
            if(!t.vencimento) return false;
            const tD = new Date(t.vencimento + "T12:00:00");
            return tD.getMonth() === d.getMonth() && tD.getFullYear() === d.getFullYear();
        }).reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
        
        balance.push(monthVal);
    }

    return { labels, balance };
};

// --- ACÇÕES GENÉRICAS ---
window.processarLancamento = async (tipo) => {
    const val = parseFloat(document.getElementById('fin-valor').value);
    const venc = document.getElementById('fin-vencimento').value;
    if (isNaN(val) || !venc) return;

    const novaTransacao = { 
        id: Date.now(), 
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa', 
        desc: document.getElementById('fin-desc').value.toUpperCase(), 
        valor: val, 
        status: document.getElementById('fin-status').value, 
        vencimento: venc,
        cat: document.getElementById('fin-categoria').value, 
        data: new Date().toLocaleDateString('pt-BR') 
    };

    window.appState.transacoes.push(novaTransacao);

    // Se for fixa 12x, gera as próximas 11
    if (document.getElementById('fin-fixa')?.checked) {
        for (let i = 1; i < 12; i++) {
            const nextDate = new Date(venc + "T12:00:00");
            nextDate.setMonth(nextDate.getMonth() + i);
            window.appState.transacoes.push({
                ...novaTransacao,
                id: Date.now() + i,
                vencimento: nextDate.toISOString().split('T')[0]
            });
        }
    }

    const ok = await pushState(); 
    if (ok) { 
        window.showToast("Lançamento Efetuado!"); 
        if (typeof window.toggleModal === 'function') window.toggleModal(); 
        updateGlobalUI(); 
    }
};

window.saveBikeEntry = async () => {
    const desc = document.getElementById('bike-log-desc')?.value;
    const km = parseInt(document.getElementById('bike-log-km')?.value);
    if (!desc || isNaN(km)) return false;
    window.appState.veiculo.km = km;
    window.appState.veiculo.historico.push({ 
        id: Date.now(), 
        desc: desc.toUpperCase(), 
        km, 
        valor: parseFloat(document.getElementById('bike-log-valor')?.value) || 0, 
        data: new Date().toLocaleDateString('pt-BR'),
        tipo: document.getElementById('bike-log-tipo')?.value || 'Manutenção'
    });
    const ok = await pushState(); 
    if (ok) { window.showToast("Registro Salvo!"); updateGlobalUI(); return true; } 
    return false;
};

window.addWater = async (ml) => { window.appState.water_ml += ml; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast(`+${ml}ml Hidratado`); } };
window.addMonster = async () => { window.appState.energy_mg += window.appState.calibragem.monster_mg; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Energizado!"); } };
window.resetHealthDay = async () => { window.appState.water_ml = 0; window.appState.energy_mg = 0; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Ciclo Zerado"); } };
window.toggleSidebar = () => { window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; updateGlobalUI(); };
window.openTab = (p) => { window.location.href = p + ".html"; };

document.addEventListener('DOMContentLoaded', () => { 
    updateGlobalUI(); 
    window.addEventListener('resize', updateGlobalUI); 
});
