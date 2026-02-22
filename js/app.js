/**
 * PULSE OS - Central Intelligence v7.5 (Google & Email Auth)
 * Makro Engenharia - Fortaleza
 * Gestão em Tempo Real com Sincronização via Firebase.
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

// Inicialização de Serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = 'pulse-os-makro';

// URL do Script de NPS da Makro Engenharia
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

// Estado Global Inicial (Definido em window para acesso pelo index.html)
window.appState = {
    login: "CARREGANDO...",
    email: "",
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    sidebarCollapsed: false,
    perfil: { 
        peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza',
        avatarConfig: { color: 'blue', icon: 'user' }
    },
    veiculo: { tipo: 'Moto', montadora: 'YAMAHA', modelo: 'FAZER 250', consumo: 29, km: 0, oleo: 38000 },
    calibragem: { monster_mg: 160, coffee_ml: 300, coffee_100ml_mg: 40 },
    tarefas: [],
    transacoes: [],
    nps_mes: "85", 
    weather: { temp: "--", icon: "sun" }
};

let activeSubmenu = sessionStorage.getItem('pulse_active_submenu');

// --- FUNÇÕES DE AUTENTICAÇÃO ---

// Login com Google
window.loginWithGoogle = async () => {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (err) {
        console.error("Erro Google Login:", err);
        throw err;
    }
};

// Login com E-mail e Senha
window.loginWithEmail = async (email, pass) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        return { success: true };
    } catch (err) {
        console.error("Erro Email Login:", err);
        let errorMsg = "Erro no acesso";
        if (err.code === 'auth/wrong-password') errorMsg = "Senha Incorreta";
        if (err.code === 'auth/user-not-found') errorMsg = "Conta não encontrada";
        return { success: false, error: errorMsg };
    }
};

// Encerrar Sessão
window.logout = async () => {
    try {
        await signOut(auth);
        window.location.href = "index.html";
    } catch (err) {
        console.error("Erro ao sair:", err);
    }
};

// Monitor de Login e Redirecionamento
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : user.email.split('@')[0].toUpperCase();
        window.appState.email = user.email;
        
        setupRealtimeSync(user.uid);
        
        // Redireciona para o dashboard se estiver na raiz ou no login
        const path = window.location.pathname;
        if (path.endsWith('index.html') || path === '/' || path.endsWith('pulse/')) {
            window.location.href = "dashboard.html";
        }
    } else {
        // Bloqueia acesso a páginas internas se deslogado
        const path = window.location.pathname;
        if (!path.endsWith('index.html') && path !== '/' && !path.endsWith('pulse/')) {
            window.location.href = "index.html";
        }
    }
});

// --- SINCRONIZAÇÃO FIRESTORE (TEMPO REAL) ---

const setupRealtimeSync = (userId) => {
    const stateDoc = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');

    onSnapshot(stateDoc, (snapshot) => {
        if (snapshot.exists()) {
            window.appState = { ...window.appState, ...snapshot.data() };
            checkDailyReset();
            updateGlobalUI();
        } else {
            // Inicializa dados na nuvem para novo usuário da Makro
            setDoc(stateDoc, window.appState);
        }
    }, (error) => console.error("Firestore Sync Error:", error));
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    try {
        await setDoc(stateDoc, window.appState);
    } catch (e) {
        console.error("Erro ao salvar dados no Firestore:", e);
    }
};

// --- AÇÕES DO SISTEMA (REGISTROS) ---

window.addWater = (ml) => {
    window.appState.water_ml += ml;
    updateGlobalUI();
    pushState();
};

window.addMonster = () => {
    const mg = window.appState.calibragem?.monster_mg || 160;
    window.appState.energy_mg += mg;
    updateGlobalUI();
    pushState();
};

window.addWorkTask = () => {
    const title = document.getElementById('work-task-title')?.value;
    if (!title) return;
    const newTask = { 
        id: Date.now(), 
        title: title.toUpperCase(), 
        status: 'Pendente', 
        data: new Date().toLocaleDateString('pt-BR') 
    };
    if (!window.appState.tarefas) window.appState.tarefas = [];
    window.appState.tarefas.push(newTask);
    document.getElementById('work-task-title').value = "";
    updateGlobalUI();
    pushState();
};

window.toggleTaskStatus = (taskId) => {
    const task = window.appState.tarefas.find(t => t.id === taskId);
    if (task) {
        task.status = task.status === 'Pendente' ? 'Concluído' : 'Pendente';
        updateGlobalUI();
        pushState();
    }
};

// --- LÓGICA DE INTERFACE (CONTROLO DA BARRA LATERAL) ---

const updateGlobalUI = () => {
    injectInterface();
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    // Sincroniza Classes do Layout com style.css
    if (mainContent && window.innerWidth >= 768) {
        mainContent.classList.remove('content-expanded', 'content-collapsed');
        mainContent.classList.add(window.appState.sidebarCollapsed ? 'content-collapsed' : 'content-expanded');
    }
    
    if (sidebar) {
        sidebar.classList.remove('sidebar-expanded', 'sidebar-collapsed');
        sidebar.classList.add(window.appState.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded');
    }
    
    const updateText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    // Saúde e Metas (Personalizadas para Weverson)
    updateText('water-current-display', window.appState.water_ml);
    updateText('dash-water-cur', window.appState.water_ml);
    updateText('energy-current-display', window.appState.energy_mg);
    updateText('dash-energy-val', window.appState.energy_mg);
    
    if (document.getElementById('dash-water-bar')) {
        document.getElementById('dash-water-bar').style.width = Math.min(100, (window.appState.water_ml / 3500) * 100) + '%';
    }
    
    updateText('dash-nps-val', window.appState.nps_mes || "0");
    updateText('bike-km-display', window.appState.veiculo.km);
    
    renderWorkTasks();
};

const renderWorkTasks = () => {
    const list = document.getElementById('work-task-active-list');
    if (!list) return;
    const pendentes = (window.appState.tarefas || []).filter(t => t.status === 'Pendente');
    const counter = document.getElementById('task-count');
    if (counter) counter.innerText = pendentes.length;

    list.innerHTML = (window.appState.tarefas || []).map(t => `
        <div class="glass-card p-4 flex items-center justify-between border-l-4 ${t.status === 'Concluído' ? 'border-emerald-500 opacity-50' : 'border-sky-500'} italic">
            <p class="text-[10px] font-black uppercase text-white ${t.status === 'Concluído' ? 'line-through' : ''}">${t.title}</p>
            <button onclick="window.toggleTaskStatus(${t.id})" class="p-2 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-all">
                <i data-lucide="${t.status === 'Concluído' ? 'rotate-ccw' : 'check'}" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!sidebarPlaceholder && !headerPlaceholder) return;

    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500' },
        { id: 'perfil', label: 'Perfil', icon: 'user', color: 'text-purple-500' }
    ];

    if (sidebarPlaceholder) {
        const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
        sidebarPlaceholder.innerHTML = `
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic ${window.appState.sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic ${window.appState.sidebarCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="${window.appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => `
                        <button onclick="window.openTab('${i.id}')" class="w-full flex items-center ${window.appState.sidebarCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                            <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                            <span class="${window.appState.sidebarCollapsed ? 'hidden' : 'block'}">${i.label}</span>
                        </button>
                    `).join('')}
                    <button onclick="window.logout()" class="w-full flex items-center ${window.appState.sidebarCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 mt-10 text-red-500/40 hover:text-red-500 transition-all italic font-black text-[10px] tracking-widest">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                        <span class="${window.appState.sidebarCollapsed ? 'hidden' : 'block'}">Sair</span>
                    </button>
                </nav>
            </aside>
        `;
    }

    if (headerPlaceholder) {
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

window.toggleSidebar = () => { 
    window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; 
    pushState(); 
    updateGlobalUI(); 
};

window.openTab = (p) => { window.location.href = p + ".html"; };

const checkDailyReset = () => {
    const today = new Date().toLocaleDateString('pt-BR');
    if (window.appState.lastHealthReset !== today) {
        window.appState.water_ml = 0; 
        window.appState.energy_mg = 0; 
        window.appState.lastHealthReset = today; 
        pushState();
    }
};

const fetchNPSData = async () => {
    try {
        const response = await fetch(NPS_SCRIPT_URL);
        const data = await response.json();
        if (data && (data.nps || data.valor)) { 
            window.appState.nps_mes = data.nps || data.valor; 
            updateGlobalUI(); 
        }
    } catch (e) {}
};

// --- INIT ---
window.addEventListener('DOMContentLoaded', () => { 
    updateGlobalUI(); 
    fetchNPSData(); 
});

window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        const active = document.activeElement; 
        if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') return;
        e.preventDefault(); 
        window.toggleSidebar();
    }
});
