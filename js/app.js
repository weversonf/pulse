/**
 * PULSE OS - Central Intelligence v8.8 (Global Sidebar Fix)
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

// --- CONFIGURAÇÃO FIREBASE (Projeto: pulse-68c1c) ---
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

const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

// Estado Global Inicial
window.appState = {
    login: "USUÁRIO",
    email: "",
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    sidebarCollapsed: false,
    perfil: { peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza' },
    veiculo: { tipo: 'Moto', km: 0, oleo: 38000, historico: [], viagens: [] },
    tarefas: [],
    transacoes: [],
    nps_mes: "85"
};

// --- AUTENTICAÇÃO ---

window.loginWithGoogle = async () => {
    try { 
        const result = await signInWithPopup(auth, googleProvider);
        return { success: true, user: result.user };
    } catch (err) { throw err; }
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

// Monitor de Sessão
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : user.email.split('@')[0].toUpperCase();
        window.appState.email = user.email;
        
        // Renderização imediata
        updateGlobalUI();
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
    }, (error) => {
        console.error("Erro na sincronização:", error);
    });
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    try {
        await setDoc(stateDoc, window.appState);
    } catch (e) { console.error("Erro ao salvar:", e); }
};

// --- INTERFACE (CONTROLE DE VISIBILIDADE) ---

const updateGlobalUI = () => {
    // 1. Injeta o HTML se não existir
    injectInterface();
    
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    if (sidebar) {
        // Força a exibição e o comportamento de flexbox
        sidebar.classList.remove('hidden');
        sidebar.style.display = 'flex';
        
        // Aplica as classes do style.css
        sidebar.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebar.classList.toggle('sidebar-expanded', !isCollapsed);
        
        // Ajusta a largura via estilo para garantir consistência
        sidebar.style.width = isCollapsed ? '5rem' : '16rem';
        
        // Esconde os textos quando colapsado
        const texts = sidebar.querySelectorAll('span, h1');
        texts.forEach(el => el.style.display = isCollapsed ? 'none' : 'block');

        // Atualiza o ícone do botão de toggle
        const toggleIcon = sidebar.querySelector('[data-lucide="chevron-left"], [data-lucide="chevron-right"]');
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', isCollapsed ? 'chevron-right' : 'chevron-left');
        }
    }

    if (mainContent) {
        // Remove classes estáticas que podem bloquear a margem dinâmica
        mainContent.classList.remove('md:ml-64');
        
        if (window.innerWidth >= 768) {
            mainContent.classList.toggle('content-collapsed', isCollapsed);
            mainContent.classList.toggle('content-expanded', !isCollapsed);
            // Garante que a margem bata com o CSS
            mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
        } else {
            mainContent.classList.remove('content-collapsed', 'content-expanded');
            mainContent.style.marginLeft = '0';
        }
    }

    // Atualização de Displays Dinâmicos
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    const efektivaj = (window.appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const receitas = efektivaj.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
    const despesas = efektivaj.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
    const saldo = receitas - despesas;
    const fundoRota = efektivaj.filter(t => t.cat === 'Transporte').reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);

    set('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('dash-saldo', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('dash-fundo', fundoRota.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('dash-water-cur', window.appState.water_ml);
    set('water-current-display', window.appState.water_ml);
    set('dash-energy-val', window.appState.energy_mg);
    set('energy-current-display', window.appState.energy_mg);
    set('dash-nps-val', window.appState.nps_mes || "0");

    // Gauge de Cafeína (Se existir no Dashboard)
    const energyPath = document.getElementById('energy-gauge-path');
    if (energyPath) {
        const percentage = Math.min(100, (window.appState.energy_mg / 400) * 100);
        const offset = 226.2 - (226.2 * percentage) / 100;
        energyPath.style.strokeDashoffset = offset;
    }

    // Barra de Água
    const waterBar = document.getElementById('dash-water-bar');
    if (waterBar) {
        waterBar.style.width = Math.min(100, (window.appState.water_ml / 3500) * 100) + '%';
    }

    if (window.lucide) lucide.createIcons();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    // Injeção da Barra Lateral
    if (sidebarPlaceholder && !sidebarPlaceholder.querySelector('aside')) {
        const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
        const items = [
            { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
            { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
            { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
            { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
            { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500' },
            { id: 'perfil', label: 'Perfil', icon: 'user', color: 'text-purple-500' }
        ];

        sidebarPlaceholder.innerHTML = `
            <aside class="flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="chevron-left" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => `
                        <button onclick="window.openTab('${i.id}')" class="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                            <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                            <span>${i.label}</span>
                        </button>
                    `).join('')}
                    <button onclick="window.logout()" class="w-full flex items-center gap-4 px-4 py-4 mt-10 text-red-500/40 hover:text-red-500 transition-all italic font-black text-[10px] tracking-widest">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                        <span>Sair</span>
                    </button>
                </nav>
            </aside>
        `;
    }

    // Injeção do Cabeçalho
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
};

window.toggleSidebar = () => { 
    window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; 
    pushState(); 
    updateGlobalUI(); 
};

window.openTab = (p) => { window.location.href = p + ".html"; };

// --- ACTIONS SAÚDE ---
window.addWater = (ml) => { window.appState.water_ml += ml; pushState(); updateGlobalUI(); };
window.addMonster = () => { window.appState.energy_mg += 160; pushState(); updateGlobalUI(); };
window.resetHealthDay = () => { window.appState.water_ml = 0; window.appState.energy_mg = 0; pushState(); updateGlobalUI(); };

// --- INIT ---
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
