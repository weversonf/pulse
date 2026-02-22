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
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pulse-os-personal';

// Estado Global Inicial
window.appState = {
    login: "USUÁRIO",
    fullName: "USUÁRIO",
    photoURL: null,
    email: "",
    energy_mg: 0,
    water_ml: 0,
    lastHealthReset: new Date().toLocaleDateString('pt-BR'),
    sidebarCollapsed: false,
    activeSubmenu: null,
    perfil: { peso: 90, altura: 175, idade: 32, sexo: 'M', estado: 'CE', cidade: 'Fortaleza' },
    veiculo: { tipo: 'Moto', km: 0, oleo: 38000, historico: [], viagens: [] },
    calibragem: { monster_mg: 160, coffee_ml: 0 },
    tarefas: [],
    transacoes: [],
    nps_mes: "0"
};

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---

window.showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all duration-500 transform translate-y-[-20px] opacity-0 italic flex items-center gap-3 border ${
        type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' : 'bg-red-950/90 border-red-500/50 text-red-400'
    }`;
    
    const icon = type === 'success' ? 'check-circle' : 'alert-circle';
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i> ${message}`;
    
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
    }, 10);

    setTimeout(() => {
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- AUTENTICAÇÃO ---

window.loginWithGoogle = async () => {
    try { 
        const result = await signInWithPopup(auth, googleProvider);
        window.showToast("Sincronizado com Google!");
        return { success: true, user: result.user };
    } catch (err) { throw err; }
};

window.loginWithEmail = async (email, pass) => {
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        window.showToast("Sessão Iniciada!");
        return { success: true };
    } catch (err) {
        window.showToast("Falha no Login", "error");
        return { success: false, error: "Falha na Autenticação" };
    }
};

window.logout = async () => {
    await signOut(auth);
    window.location.href = "index.html";
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USUÁRIO";
        window.appState.fullName = user.displayName || "USUÁRIO";
        window.appState.photoURL = user.photoURL || null;
        window.appState.email = user.email;
        
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
    if (!userId) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    onSnapshot(stateDoc, (snapshot) => {
        if (snapshot.exists()) {
            const cloudData = snapshot.data();
            const currentLocalSidebar = window.appState.sidebarCollapsed;
            const googlePhoto = window.appState.photoURL;
            const googleName = window.appState.fullName;
            
            window.appState = { ...window.appState, ...cloudData };
            window.appState.sidebarCollapsed = currentLocalSidebar;
            window.appState.photoURL = googlePhoto; // Mantém a foto do Google como prioridade
            window.appState.fullName = googleName;
            
            updateGlobalUI();
        } else {
            setDoc(stateDoc, window.appState);
        }
    }, (error) => console.error("Sync Error:", error));
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    
    const dataToSync = { ...window.appState };
    delete dataToSync.sidebarCollapsed; 
    delete dataToSync.photoURL; // Não precisa salvar a URL da foto, ela vem do Auth

    try { 
        await setDoc(stateDoc, dataToSync); 
        return true;
    } catch (e) { 
        console.error("Save Error:", e);
        window.showToast("Erro ao Sincronizar", "error");
        return false;
    }
};

// --- INTERFACE ---

const updateGlobalUI = () => {
    injectInterface();
    
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    
    if (sidebar) {
        sidebar.classList.toggle('sidebar-collapsed', isCollapsed);
        sidebar.classList.toggle('sidebar-expanded', !isCollapsed);
        sidebar.style.width = isCollapsed ? '5rem' : '16rem';
        const texts = sidebar.querySelectorAll('.menu-label, h1');
        texts.forEach(el => el.style.display = isCollapsed ? 'none' : 'block');
    }

    if (mainContent) {
        if (window.innerWidth >= 768) {
            mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
            mainContent.style.paddingBottom = '0';
        } else {
            mainContent.style.marginLeft = '0';
            mainContent.style.paddingBottom = '5rem'; 
        }
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const efektivaj = (window.appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const receitas = efektivaj.filter(t => t.tipo === 'Receita').reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);
    const despesas = efektivaj.filter(t => t.tipo === 'Despesa').reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);
    const saldo = receitas - despesas;

    set('dash-saldo', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('total-income', receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('total-expenses', despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('dash-water-cur', window.appState.water_ml);
    set('water-current-display', window.appState.water_ml);
    set('bike-km-display', window.appState.veiculo.km);

    // Atualiza nome e foto em páginas como Perfil se existirem
    const profName = document.getElementById('profile-user-name');
    if (profName) profName.innerText = window.appState.fullName;
    
    const avatarImg = document.getElementById('avatar-preview-container');
    if (avatarImg && window.appState.photoURL) {
        avatarImg.innerHTML = `<img src="${window.appState.photoURL}" class="w-full h-full object-cover rounded-full" />`;
    }

    if (window.lucide) lucide.createIcons();
    if (typeof renderFullExtrato === 'function') renderFullExtrato();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    
    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'Tarefas', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Finanças', icon: 'wallet', color: 'text-emerald-500' }
    ];

    const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];

    if (sidebarPlaceholder && !sidebarPlaceholder.querySelector('aside')) {
        sidebarPlaceholder.innerHTML = `
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
                        <i data-lucide="${window.appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => `
                        <button onclick="window.openTab('${i.id}')" class="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                            <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                            <span class="menu-label">${i.label}</span>
                        </button>
                    `).join('')}
                    <button onclick="window.openTab('perfil')" class="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === 'perfil' ? 'bg-white/5 text-purple-500' : 'text-slate-400 hover:bg-white/5'}">
                        <i data-lucide="user" class="w-5 h-5 text-purple-500"></i>
                        <span class="menu-label">Perfil</span>
                    </button>
                    <button onclick="window.logout()" class="w-full flex items-center gap-4 px-4 py-4 mt-10 text-red-500/40 hover:text-red-500 transition-all italic font-black text-[10px] tracking-widest">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                        <span class="menu-label">Sair</span>
                    </button>
                </nav>
            </aside>

            <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 py-3 z-[100] italic shadow-2xl">
                ${items.map(i => `
                    <button onclick="window.openTab('${i.id}')" class="flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${path === i.id ? 'text-blue-500' : 'text-slate-500'}">
                        <i data-lucide="${i.icon}" class="w-5 h-5 ${path === i.id ? i.color : ''}"></i>
                        <span class="text-[7px] font-black uppercase tracking-tighter">${i.label}</span>
                    </button>
                `).join('')}
                <button onclick="window.openTab('perfil')" class="flex flex-col items-center gap-1 p-2 rounded-xl ${path === 'perfil' ? 'text-purple-500' : 'text-slate-500'}">
                    <i data-lucide="user" class="w-5 h-5"></i>
                    <span class="text-[7px] font-black uppercase tracking-tighter">Perfil</span>
                </button>
            </nav>
        `;
    }

    if (headerPlaceholder && !headerPlaceholder.querySelector('header')) {
        const photo = window.appState.photoURL || '';
        const name = window.appState.login || 'USUÁRIO';
        
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <div class="flex items-center gap-3">
                    ${photo ? `<img src="${photo}" class="w-8 h-8 rounded-full border border-white/10 shadow-lg" onerror="this.style.display='none'"/>` : `<div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 border border-blue-500/30"><i data-lucide="user" class="w-4 h-4"></i></div>`}
                    <div class="flex flex-col">
                        <span class="text-[8px] font-black text-blue-500/60 uppercase tracking-[0.2em] mb-1 leading-none italic">SISTEMA PULSE</span>
                        <h2 class="text-sm font-black uppercase text-white leading-none italic">${name}</h2>
                    </div>
                </div>
                <button onclick="window.openTab('ajustes')" class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                    <i data-lucide="settings" class="w-4 h-4"></i>
                </button>
            </header>
        `;
    }
};

// --- AÇÕES DO SISTEMA ---

window.savePulseSettings = async () => {
    let changed = false;

    if (document.getElementById('set-bike-tipo')) {
        window.appState.veiculo.tipo = document.getElementById('set-bike-tipo').value;
        window.appState.veiculo.montadora = document.getElementById('set-bike-montadora').value;
        window.appState.veiculo.modelo = document.getElementById('set-bike-modelo').value;
        window.appState.veiculo.km = parseInt(document.getElementById('set-bike-km').value) || 0;
        window.appState.veiculo.oleo = parseInt(document.getElementById('set-bike-oleo').value) || 0;
        window.appState.veiculo.consumo = parseFloat(document.getElementById('set-bike-consumo').value) || 29;
        changed = true;
    }

    if (document.getElementById('set-calib-monster')) {
        if (!window.appState.calibragem) window.appState.calibragem = {};
        window.appState.calibragem.monster_mg = parseInt(document.getElementById('set-calib-monster').value) || 160;
        window.appState.calibragem.coffee_ml = parseInt(document.getElementById('set-calib-ml').value) || 0;
        
        window.appState.perfil.alcoholTitle = document.getElementById('set-alcohol-title').value;
        window.appState.perfil.alcoholStart = document.getElementById('set-alcohol-start').value;
        window.appState.perfil.alcoholTarget = parseInt(document.getElementById('set-alcohol-target').value) || 30;
        changed = true;
    }

    if (document.getElementById('set-peso')) {
        window.appState.perfil.peso = parseFloat(document.getElementById('set-peso').value) || 0;
        window.appState.perfil.altura = parseInt(document.getElementById('set-altura').value) || 0;
        window.appState.perfil.idade = parseInt(document.getElementById('set-idade').value) || 0;
        window.appState.perfil.sexo = document.getElementById('set-sexo').value;
        window.appState.perfil.estado = document.getElementById('set-estado').value;
        window.appState.perfil.cidade = document.getElementById('set-cidade').value;
        changed = true;
    }

    if (changed) {
        const success = await pushState();
        if (success) {
            window.showToast("Dados Pessoais Salvos!");
            updateGlobalUI();
        }
    }
};

window.processarLancamento = async (tipo) => {
    const desc = document.getElementById('fin-desc')?.value.trim();
    const valor = parseFloat(document.getElementById('fin-valor')?.value);
    const venc = document.getElementById('fin-vencimento')?.value;
    const status = document.getElementById('fin-status')?.value || 'Efetivada';
    const cat = document.getElementById('fin-categoria')?.value || 'Geral';

    if (!desc || isNaN(valor)) {
        window.showToast("Dados Inválidos", "error");
        return;
    }

    const lancamento = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        desc: desc.toUpperCase(),
        valor: valor,
        vencimento: venc || new Date().toISOString().split('T')[0],
        status: status,
        cat: cat,
        data: new Date().toLocaleDateString('pt-BR')
    };

    if (!window.appState.transacoes) window.appState.transacoes = [];
    window.appState.transacoes.push(lancamento);

    const success = await pushState();
    if (success) {
        window.showToast("Lançamento Efetuado!");
        updateGlobalUI();
        if (typeof window.toggleModal === 'function') window.toggleModal();
        if(document.getElementById('fin-desc')) document.getElementById('fin-desc').value = "";
        if(document.getElementById('fin-valor')) document.getElementById('fin-valor').value = "";
    }
};

window.addWorkTask = async () => {
    const title = document.getElementById('work-task-title')?.value;
    const type = document.getElementById('work-task-type')?.value || "Geral";
    const req = document.getElementById('work-task-requester')?.value || "Próprio";
    if (!title) return;

    const newTask = {
        id: Date.now(),
        title: title.toUpperCase(),
        type: type,
        requester: req,
        status: 'Pendente',
        data: new Date().toLocaleDateString('pt-BR')
    };

    if (!window.appState.tarefas) window.appState.tarefas = [];
    window.appState.tarefas.push(newTask);
    
    const success = await pushState();
    if (success) {
        window.showToast("Atividade Registrada!");
        if (document.getElementById('work-task-title')) document.getElementById('work-task-title').value = "";
        updateGlobalUI();
    }
};

window.saveBikeEntry = async () => {
    const desc = document.getElementById('bike-log-desc')?.value;
    const km = parseInt(document.getElementById('bike-log-km')?.value);
    const valor = parseFloat(document.getElementById('bike-log-valor')?.value) || 0;
    const tipo = document.getElementById('bike-log-tipo')?.value || 'Manutenção';
    if (!desc || isNaN(km)) return false;

    const entry = {
        id: Date.now(),
        desc: desc.toUpperCase(),
        km: km,
        valor: valor,
        tipo: tipo,
        data: new Date().toLocaleDateString('pt-BR')
    };

    window.appState.veiculo.km = km;
    if (!window.appState.veiculo.historico) window.appState.veiculo.historico = [];
    window.appState.veiculo.historico.push(entry);
    
    const success = await pushState();
    if (success) {
        window.showToast("Log da Fazer 250 Salvo!");
        updateGlobalUI();
        return true;
    }
    return false;
};

// --- NAVEGAÇÃO E CONTROLES ---

window.toggleSidebar = () => { 
    window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; 
    updateGlobalUI(); 
};

window.openTab = (p) => { window.location.href = p + ".html"; };

// --- ACTIONS SAÚDE ---
window.addWater = (ml) => { 
    window.appState.water_ml += ml; 
    pushState(); 
    updateGlobalUI(); 
    window.showToast(`+${ml}ml Hidratado`);
};
window.addMonster = () => { 
    window.appState.energy_mg += 160; 
    pushState(); 
    updateGlobalUI(); 
    window.showToast("Cafeína Injetada!");
};
window.resetHealthDay = () => { 
    window.appState.water_ml = 0; 
    window.appState.energy_mg = 0; 
    pushState(); 
    updateGlobalUI(); 
    window.showToast("Dashboard Zerado para hoje");
};

// --- INIT ---
updateGlobalUI();
window.addEventListener('resize', updateGlobalUI);
