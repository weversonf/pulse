/**
 * PULSE OS - Central Intelligence v8.5 (Sidebar Absolute Fix)
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

// Estado Global Inicial (Importante para o Financas.html)
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
        
        // Renderiza a interface básica antes mesmo do Firebase responder os dados
        updateGlobalUI();
        
        setupRealtimeSync(user.uid);
        
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.endsWith('pulse/')) {
            window.location.href = "dashboard.html";
        }
    } else {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/' && !window.location.pathname.endsWith('pulse/')) {
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
            // Inicializa se não existir nada na nuvem
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

// --- INTERFACE (SIDEBAR BLINDADA) ---

const updateGlobalUI = () => {
    // 1. Garante a injeção do HTML do menu
    injectInterface();
    
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    // 2. Controla o layout baseado no estado colapsado
    if (sidebar) {
        sidebar.style.width = isCollapsed ? '80px' : '256px';
        sidebar.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebar.classList.toggle('sidebar-expanded', !isCollapsed);
        
        // Esconde textos do menu se estiver fechado
        const texts = sidebar.querySelectorAll('span, h1');
        texts.forEach(el => {
            el.style.display = isCollapsed ? 'none' : 'block';
        });

        // Ajusta ícone do botão de toggle
        const toggleIcon = sidebar.querySelector('[data-lucide="chevron-left"], [data-lucide="chevron-right"]');
        if (toggleIcon) {
            toggleIcon.setAttribute('data-lucide', isCollapsed ? 'chevron-right' : 'chevron-left');
        }
    }

    if (mainContent) {
        // Se mobile (< 768px), ignora margem. Se desktop, ajusta.
        if (window.innerWidth >= 768) {
            mainContent.style.marginLeft = isCollapsed ? '80px' : '256px';
        } else {
            mainContent.style.marginLeft = '0';
        }
    }

    // 3. Atualiza dados comuns que existem em múltiplas telas
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    // Cálculos de Finanças (Efetivados)
    const efektivaj = (window.appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const receitas = efektivaj.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
    const despesas = efektivaj.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + (parseFloat(t.valor) || 0), 0);
    const saldo = receitas - despesas;

    set('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('total-income', receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('total-expenses', despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('dash-saldo', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    
    // Dados de Saúde
    set('dash-water-cur', window.appState.water_ml);
    set('water-current-display', window.appState.water_ml);
    set('dash-energy-val', window.appState.energy_mg);
    
    // NPS
    set('dash-nps-val', window.appState.nps_mes || "0");

    if (window.lucide) lucide.createIcons();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    // Só injeta se o placeholder existir e a barra ainda não estiver lá
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
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="${window.appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
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

// --- ACTIONS FINANCEIRAS ---

window.processarLancamento = async (tipo) => {
    const desc = document.getElementById('fin-desc')?.value.trim();
    const valor = parseFloat(document.getElementById('fin-valor')?.value);
    const venc = document.getElementById('fin-vencimento')?.value;
    const status = document.getElementById('fin-status')?.value;
    
    if (!desc || isNaN(valor)) return;

    const lancamento = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        desc: desc.toUpperCase(),
        valor: valor,
        vencimento: venc || new Date().toISOString().split('T')[0],
        status: status || 'Efetivada',
        cat: document.getElementById('fin-categoria')?.value || 'Geral'
    };

    if (!window.appState.transacoes) window.appState.transacoes = [];
    window.appState.transacoes.push(lancamento);
    
    // Persiste e atualiza
    await pushState();
    updateGlobalUI();
    
    // Fecha modal se a função existir
    if (typeof toggleModal === 'function') toggleModal();
};

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => { 
    // Garante uma tentativa de render inicial
    updateGlobalUI();

    // Atalho Ctrl+B para o menu
    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
            const active = document.activeElement;
            if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;
            e.preventDefault(); 
            window.toggleSidebar();
        }
    });
});

window.addEventListener('resize', updateGlobalUI);
