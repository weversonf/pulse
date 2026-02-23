/**
 * PULSE OS - Central Intelligence v13.1 (Merged Settings Edition)
 * Gestão Total: Saúde, Finanças e Veículo (Yamaha Fazer 250).
 * Sincronização em Tempo Real via Firebase 12.9.0 & Identidade Google.
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

// --- CONFIGURAÇÃO FIREBASE (pulse-68c1c) ---
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
    perfil: { 
        peso: 90, altura: 175, idade: 32, sexo: 'M', 
        estado: 'CE', cidade: 'Fortaleza', 
        alcoholTitle: "ZERO ÁLCOOL", alcoholStart: "", alcoholTarget: 30 
    },
    veiculo: { 
        tipo: 'Moto', km: 0, oleo: 38000, consumo: 29, 
        montadora: "YAMAHA", modelo: "FAZER 250", 
        historico: [], viagens: [] 
    },
    calibragem: { monster_mg: 160, coffee_ml: 300 },
    tarefas: [],
    transacoes: []
};

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
window.showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all duration-500 transform translate-y-[-20px] opacity-0 italic flex items-center gap-3 border ${
        type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' : 'bg-red-950/90 border-red-500/50 text-red-400'
    }`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i> ${message}`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.classList.remove('translate-y-[-20px]', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('translate-y-[-20px]', 'opacity-0');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// --- AUTENTICAÇÃO ---
window.loginWithGoogle = async () => {
    try { 
        await signInWithPopup(auth, googleProvider); 
        window.showToast("Google Sync Ativado!"); 
    } catch (err) { 
        console.error(err);
        window.showToast("Erro na Autenticação", "error");
    }
};

window.logout = async () => { await signOut(auth); window.location.href = "index.html"; };

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USUÁRIO";
        window.appState.fullName = user.displayName || "USUÁRIO";
        // Só usa a foto do Google se não houver um avatar personalizado (ICON:...)
        if(!window.appState.photoURL || !window.appState.photoURL.startsWith('ICON:')) {
            window.appState.photoURL = user.photoURL || null;
        }
        window.appState.email = user.email;
        
        setupRealtimeSync(user.uid);
        updateGlobalUI(); 
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') window.location.href = "dashboard.html";
    } else if (!window.location.pathname.endsWith('index.html')) {
        window.location.href = "index.html";
    }
});

// --- FIRESTORE ---
const setupRealtimeSync = (userId) => {
    if (!userId) return;
    const stateDoc = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    
    onSnapshot(stateDoc, (snapshot) => {
        if (snapshot.exists()) {
            const cloudData = snapshot.data();
            const currentSidebar = window.appState.sidebarCollapsed;
            
            // Mescla dados prevenindo perda de sessão do Google
            window.appState = { 
                ...window.appState, 
                ...cloudData,
                sidebarCollapsed: currentSidebar,
                login: window.appState.login,
                fullName: window.appState.fullName,
                email: window.appState.email
            };

            updateGlobalUI();
            
            // Se estiver na página de ajustes, popula o formulário
            if (typeof window.fillAjustesForm === 'function') {
                window.fillAjustesForm();
            }
        } else {
            pushState(); 
        }
    }, (error) => {
        console.error("Sync Error:", error);
        if (error.code === 'permission-denied') window.showToast("Firebase: Sem Acesso", "error");
    });
};

const pushState = async () => {
    if (!auth.currentUser) return false;
    const stateDoc = doc(db, 'artifacts', appId, 'users', auth.currentUser.uid, 'state', 'current');
    
    const dataToSync = JSON.parse(JSON.stringify(window.appState));
    // Removemos o que não deve ser persistido na nuvem como "preferência global"
    delete dataToSync.sidebarCollapsed; 
    delete dataToSync.fullName;
    delete dataToSync.login;
    delete dataToSync.email;

    try { 
        await setDoc(stateDoc, dataToSync, { merge: true }); 
        console.log("PULSE: Cloud Sync Ok");
        return true; 
    } catch (e) { 
        console.error("Save Error:", e);
        return false; 
    }
};

// --- INTERFACE ---
const updateGlobalUI = () => {
    injectInterface();
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    const sidebar = document.querySelector('aside');
    const headerLogo = document.getElementById('header-logo');
    
    if (sidebar) {
        sidebar.style.width = isCollapsed ? '5rem' : '16rem';
        sidebar.querySelectorAll('.menu-label, h1').forEach(el => el.style.display = isCollapsed ? 'none' : 'block');
    }

    if (headerLogo) {
        if (window.innerWidth < 768) {
            headerLogo.style.opacity = '1';
        } else {
            headerLogo.style.opacity = isCollapsed ? '1' : '0';
            headerLogo.style.pointerEvents = isCollapsed ? 'auto' : 'none';
        }
    }

    if (mainContent) {
        if (window.innerWidth >= 768) mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
        else mainContent.style.paddingBottom = '5rem';
    }

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    const efektivaj = (window.appState.transacoes || []).filter(t => t.status === 'Efetivada');
    const saldo = efektivaj.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    
    set('dash-saldo', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 0 }));
    set('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    set('dash-water-cur', window.appState.water_ml);
    set('water-current-display', window.appState.water_ml);
    set('energy-current-display', window.appState.energy_mg);
    set('dash-energy-val', window.appState.energy_mg); 
    set('bike-km-display', window.appState.veiculo.km);

    const wBar = document.getElementById('dash-water-bar');
    if (wBar) wBar.style.width = Math.min(100, (window.appState.water_ml / 3500) * 100) + '%';
    
    const eGauge = document.getElementById('energy-gauge-path');
    if (eGauge) {
        const percent = Math.min(100, (window.appState.energy_mg / 400) * 100);
        eGauge.style.strokeDashoffset = 226.2 - (226.2 * percent) / 100;
    }

    const p = window.appState.perfil;
    const alcStart = p.alcoholStart;
    if (alcStart && document.getElementById('alcohol-days-count')) {
        const diff = Math.floor((new Date() - new Date(alcStart)) / (1000 * 60 * 60 * 24));
        set('alcohol-days-count', Math.max(0, diff));
        set('alcohol-target-display', p.alcoholTarget || 30);
        const aBar = document.getElementById('alcohol-bar');
        if (aBar) aBar.style.width = Math.min(100, (diff / (p.alcoholTarget || 30)) * 100) + '%';
        set('alcohol-challenge-title', p.alcoholTitle);
    }

    // Lógica de Avatar
    const avatar = document.getElementById('avatar-preview-container');
    if (avatar && window.appState.photoURL) {
        if(window.appState.photoURL.startsWith('ICON:')) {
            const [_, color, icon] = window.appState.photoURL.split(':');
            avatar.innerHTML = `<i data-lucide="${icon}" class="w-10 h-10 text-${color}-500"></i>`;
        } else {
            avatar.innerHTML = `<img src="${window.appState.photoURL}" class="w-full h-full object-cover rounded-full" />`;
        }
    }

    const tasks = window.appState.tarefas || [];
    set('task-count', tasks.filter(t => t.status === 'Pendente').length);
    set('dash-tasks-progress', tasks.length);
    set('dash-tasks-remaining', tasks.filter(t => t.status === 'Pendente').length);

    if (window.lucide) lucide.createIcons();
    if (typeof renderWorkTasks === 'function') renderWorkTasks();
};

const injectInterface = () => {
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder') || document.getElementById('menu-container');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!sidebarPlaceholder) return;

    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Máquina', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'Tarefas', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Finanças', icon: 'wallet', color: 'text-emerald-500' },
        { id: 'ajustes', label: 'Ajustes', icon: 'settings', color: 'text-slate-400' }
    ];
    const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];

    if (!sidebarPlaceholder.querySelector('aside')) {
        sidebarPlaceholder.innerHTML = `
            <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
                <div class="p-6 flex items-center justify-between">
                    <h1 class="text-2xl font-black text-blue-500 italic">PULSE</h1>
                    <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors">
                        <i data-lucide="${window.appState.sidebarCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                    </button>
                </div>
                <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                    ${items.map(i => `<button onclick="window.openTab('${i.id}')" class="w-full flex items-center gap-4 px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all"><i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i><span class="menu-label">${i.label}</span></button>`).join('')}
                    <button onclick="window.logout()" class="w-full flex items-center gap-4 px-4 py-4 mt-6 text-red-500/40 hover:text-red-500 transition-all italic font-black text-[10px] tracking-widest border-t border-white/5">
                        <i data-lucide="log-out" class="w-5 h-5"></i><span class="menu-label">Sair</span>
                    </button>
                </nav>
            </aside>
            <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 py-3 z-[100] italic shadow-2xl">
                ${items.slice(0, 5).map(i => `<button onclick="window.openTab('${i.id}')" class="flex flex-col items-center gap-1 p-2 ${path === i.id ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="${i.icon}" class="w-5 h-5"></i><span class="text-[7px] font-black uppercase">${i.label}</span></button>`).join('')}
                <button onclick="window.openTab('ajustes')" class="flex flex-col items-center gap-1 p-2 ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="settings" class="w-5 h-5"></i><span class="text-[7px] font-black uppercase">Ajustes</span></button>
            </nav>
        `;
    }

    if (headerPlaceholder && !headerPlaceholder.querySelector('header')) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <div id="header-logo" class="transition-opacity duration-300">
                    <h1 class="text-xl font-black text-blue-500 italic tracking-tighter">PULSE</h1>
                </div>
                <button onclick="window.openTab('veiculo')" class="w-10 h-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-500 hover:bg-orange-600 hover:text-white transition-all shadow-lg">
                    <i data-lucide="fuel" class="w-5 h-5"></i>
                </button>
            </header>
        `;
    }
};

// --- AÇÕES ---
window.savePulseSettings = async () => {
    const v = window.appState.veiculo;
    const p = window.appState.perfil;
    const c = window.appState.calibragem;

    // Captura campos unificados da página ajustes.html
    if (document.getElementById('set-bike-tipo')) {
        v.tipo = document.getElementById('set-bike-tipo').value;
        v.montadora = document.getElementById('set-bike-montadora')?.value;
        v.modelo = document.getElementById('set-bike-modelo')?.value;
        v.km = parseInt(document.getElementById('set-bike-km').value) || 0;
        v.oleo = parseInt(document.getElementById('set-bike-oleo').value) || 0;
        v.consumo = parseFloat(document.getElementById('set-bike-consumo').value) || 29;

        p.peso = parseFloat(document.getElementById('set-peso').value) || 0;
        p.altura = parseInt(document.getElementById('set-altura').value) || 0;
        p.idade = parseInt(document.getElementById('set-idade').value) || 0;
        p.sexo = document.getElementById('set-sexo').value;
        p.estado = document.getElementById('set-estado').value;
        p.cidade = document.getElementById('set-cidade').value;

        c.monster_mg = parseInt(document.getElementById('set-calib-monster').value) || 160;
        c.coffee_ml = parseInt(document.getElementById('set-calib-ml').value) || 0;

        p.alcoholTitle = document.getElementById('set-alcohol-title').value;
        p.alcoholStart = document.getElementById('set-alcohol-start').value;
        p.alcoholTarget = parseInt(document.getElementById('set-alcohol-target').value) || 30;
    }
    
    const success = await pushState();
    if (success) { 
        window.showToast("Cloud Sincronizado!"); 
        updateGlobalUI(); 
    }
};

window.renderWorkTasks = () => {
    const list = document.getElementById('work-task-active-list');
    if (!list) return;
    const tasks = window.appState.tarefas || [];
    list.innerHTML = tasks.map(t => `
        <div class="glass-card p-4 flex justify-between items-center italic">
            <div>
                <p class="text-[10px] font-black text-white uppercase italic">${t.title}</p>
                <p class="text-[8px] font-bold text-slate-500 uppercase mt-1 italic">${t.type} • ${t.requester} ${t.deadline ? '• ' + t.deadline : ''}</p>
            </div>
            <button onclick="window.deleteTask(${t.id})" class="text-slate-700 hover:text-red-500 transition-colors"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
    `).join('');
    if (window.lucide) lucide.createIcons();
};

window.addWorkTask = async () => {
    const title = document.getElementById('work-task-title')?.value;
    if (!title) return;
    window.appState.tarefas.push({ id: Date.now(), title, type: document.getElementById('work-task-type').value, requester: document.getElementById('work-task-requester').value, deadline: document.getElementById('work-task-deadline')?.value || "", status: 'Pendente' });
    document.getElementById('work-task-title').value = "";
    await pushState(); updateGlobalUI(); window.showToast("Tarefa Adicionada!");
};

window.deleteTask = async (id) => {
    window.appState.tarefas = window.appState.tarefas.filter(t => t.id !== id);
    await pushState(); updateGlobalUI(); window.showToast("Removido!", "error");
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
        data: new Date().toLocaleDateString('pt-BR') 
    });
    const ok = await pushState();
    if (ok) { window.showToast("Registo Salvo!"); updateGlobalUI(); return true; }
    return false;
};

window.processarLancamento = async (tipo) => {
    const val = parseFloat(document.getElementById('fin-valor').value);
    if (isNaN(val)) return;
    window.appState.transacoes.push({ 
        id: Date.now(), 
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa', 
        desc: document.getElementById('fin-desc').value.toUpperCase(), 
        valor: val, 
        status: document.getElementById('fin-status').value, 
        vencimento: document.getElementById('fin-vencimento').value,
        cat: document.getElementById('fin-categoria').value,
        data: new Date().toLocaleDateString('pt-BR') 
    });
    const ok = await pushState();
    if (ok) { 
        window.showToast("Lançamento Efetuado!"); 
        updateGlobalUI();
        if (typeof window.toggleModal === 'function') window.toggleModal();
    }
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
