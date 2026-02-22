/**
 * PULSE OS - Central Intelligence v8.9 (Sub-menu & Sidebar Absolute Fix)
 * Makro Engenharia - Fortaleza
 * Gestão em Tempo Real com Sincronização Google & Email via Firebase.
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
const appId = 'pulse-os-makro';

// Estado Global Inicial
window.appState = {
    login: "USUÁRIO",
    email: "",
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    sidebarCollapsed: false,
    activeSubmenu: null, // Controla qual sub-menu está aberto
    perfil: { peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza' },
    veiculo: { tipo: 'Moto', km: 0, oleo: 38000, historico: [], viagens: [] },
    tarefas: [],
    transacoes: [],
    nps_mes: "85"
};

// --- AUTENTICAÇÃO ---

window.loginWithGoogle = async () => {
    try { await signInWithPopup(auth, googleProvider); } catch (err) { throw err; }
};

window.loginWithEmail = async (email, pass) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        return { success: true };
    } catch (err) {
        return { success: false, error: "Falha na Autenticação" };
    }
};

window.logout = async () => {
    await signOut(auth);
    window.location.href = "index.html";
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : user.email.split('@')[0].toUpperCase();
        window.appState.email = user.email;
        
        updateGlobalUI(); // Render imediato
        setupRealtimeSync(user.uid);
        
        const path = window.location.pathname;
        if (path.endsWith('index.html') || path === '/' || path.endsWith('pulse/')) {
            window.location.href = "dashboard.html";
        }
    } else {
        const path = window.location.pathname;
        if (!path.endsWith('index.html') && path !== '/' && !path.endsWith('pulse/')) {
            window.location.href = "index.html";
        }
    }
});

// --- FIRESTORE ---

const setupRealtimeSync = (userId) => {
    const stateDoc = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    onSnapshot(stateDoc, (snapshot) => {
        if (snapshot.exists()) {
            window.appState = { ...window.appState, ...snapshot.data() };
            updateGlobalUI();
        } else {
            setDoc(stateDoc, window.appState);
        }
    }, (error) => console.error("Erro Sync:", error));
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    try { await setDoc(stateDoc, window.appState); } catch (e) { console.error("Erro Save:", e); }
};

// --- INTERFACE (SIDEBAR COM SUB-MENU) ---

const updateGlobalUI = () => {
    injectInterface();
    
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    if (sidebar) {
        sidebar.classList.remove('hidden');
        sidebar.style.display = 'flex';
        sidebar.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebar.classList.toggle('sidebar-expanded', !isCollapsed);
        sidebar.style.width = isCollapsed ? '5rem' : '16rem';
        
        const texts = sidebar.querySelectorAll('.menu-label, h1');
        texts.forEach(el => el.style.display = isCollapsed ? 'none' : 'block');
    }

    if (mainContent && window.innerWidth >= 768) {
        mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
    }

    // Atualização de Saldos e Saúde
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const efektivaj = (window.appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const saldo = efektivaj.reduce((acc, t) => acc + (t.tipo === 'Receita' ? parseFloat(t.valor) : -parseFloat(t.valor)), 0);
    const fundoRota = efektivaj.filter(t => t.cat === 'Transporte').reduce((acc, t) => acc + parseFloat(t.valor), 0);

    set('dash-saldo', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('dash-fundo', fundoRota.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('dash-water-cur', window.appState.water_ml);
    set('dash-nps-val', window.appState.nps_mes || "0");

    if (window.lucide) lucide.createIcons();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    if (sidebarPlaceholder && !sidebarPlaceholder.querySelector('aside')) {
        const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
        
        // Definição dos itens com suporte a sub-menu
        const items = [
            { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
            { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
            { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
            { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
            { 
                id: 'financas', 
                label: 'Money', 
                icon: 'wallet', 
                color: 'text-emerald-500',
                submenu: [
                    { id: 'extrato', label: 'Extrato', icon: 'list' }
                ]
            },
            { id: 'perfil', label: 'Perfil', icon: 'user', color: 'text-purple-500' }
        ];

        sidebarPlaceholder.innerHTML = `
            <aside class="flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="${window.appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => {
                        const hasSub = i.submenu && i.submenu.length > 0;
                        const isOpen = window.appState.activeSubmenu === i.id;
                        const isActive = path === i.id || (hasSub && i.submenu.some(s => s.id === path));
                        
                        return `
                            <div class="space-y-1">
                                <button onclick="${hasSub ? `window.toggleSubmenu('${i.id}')` : `window.openTab('${i.id}')`}" 
                                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${isActive ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                                    <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                                    <span class="menu-label flex-1 text-left">${i.label}</span>
                                    ${hasSub && !window.appState.sidebarCollapsed ? `<i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" class="w-3 h-3 opacity-50"></i>` : ''}
                                </button>
                                
                                ${hasSub && isOpen && !window.appState.sidebarCollapsed ? `
                                    <div class="pl-12 space-y-1 animate-in slide-in-from-top-2 duration-200">
                                        ${i.submenu.map(sub => `
                                            <button onclick="window.openTab('${sub.id}')" 
                                                class="w-full flex items-center gap-3 py-3 text-slate-500 hover:text-white transition-colors text-[9px] font-black uppercase tracking-widest ${path === sub.id ? 'text-blue-500' : ''}">
                                                <i data-lucide="${sub.icon}" class="w-3 h-3"></i>
                                                <span>${sub.label}</span>
                                            </button>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                    
                    <button onclick="window.logout()" class="w-full flex items-center gap-4 px-4 py-4 mt-10 text-red-500/40 hover:text-red-500 transition-all italic font-black text-[10px] tracking-widest">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                        <span class="menu-label">Sair</span>
                    </button>
                </nav>
            </aside>
        `;
    }

    if (headerPlaceholder && !headerPlaceholder.querySelector('header')) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <div class="flex flex-col">
                    <span class="text-[8px] font-black text-blue-500/60 uppercase tracking-[0.2em] mb-1 leading-none italic">Makro Engenharia</span>
                    <h2 class="text-sm font-black uppercase text-white leading-none italic">${window.appState.login}</h2>
                </div>
                <button onclick="window.openTab('ajustes')" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <i data-lucide="settings" class="w-4 h-4"></i>
                </button>
            </header>
        `;
    }
    if (window.lucide) lucide.createIcons();
};

window.toggleSubmenu = (id) => {
    window.appState.activeSubmenu = window.appState.activeSubmenu === id ? null : id;
    updateGlobalUI();
};

window.toggleSidebar = () => { 
    window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; 
    pushState(); 
    updateGlobalUI(); 
};

window.openTab = (p) => { window.location.href = p + ".html"; };

// --- ACTIONS ---
window.addWater = (ml) => { window.appState.water_ml += ml; pushState(); updateGlobalUI(); };
window.addMonster = () => { window.appState.energy_mg += 160; pushState(); updateGlobalUI(); };

window.addEventListener('DOMContentLoaded', () => { 
    updateGlobalUI();
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            e.preventDefault(); 
            window.toggleSidebar();
        }
    });
});

window.addEventListener('resize', updateGlobalUI);
