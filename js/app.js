/**
 * PULSE OS - Central Intelligence v14.7
 * Gestão Total: Saúde, Finanças e Veículo.
 * Sincronização em Tempo Real via Firebase & Google Auth.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithCustomToken, 
    signInAnonymously 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import { 
    getFirestore, 
    doc, 
    setDoc, 
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

// --- CONFIGURAÇÃO FIREBASE (SEGURANÇA & AMBIENTE) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'pulse-os-personal-weverson';

// --- ESTADO GLOBAL ---
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

window.currentSystemDate = new Date();

// --- NOTIFICAÇÕES (TOAST) ---
window.showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all duration-500 flex items-center gap-3 border ${type === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-400' : 'bg-red-950/90 border-red-500/50 text-red-400'}`;
    toast.innerHTML = `<i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i> ${message}`;
    document.body.appendChild(toast);
    if (window.lucide) lucide.createIcons();
    setTimeout(() => toast.remove(), 3500);
};

// --- AUTENTICAÇÃO (REGRA 3) ---
const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Erro na autenticação:", error);
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        window.appState.login = user.displayName ? user.displayName.split(' ')[0].toUpperCase() : "USUÁRIO";
        setupRealtimeSync(user.uid);
    } else {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = "index.html";
        }
    }
});

// --- SINCRONIZAÇÃO EM TEMPO REAL ---
const setupRealtimeSync = (userId) => {
    if (!userId) return;
    const stateDocRef = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    
    onSnapshot(stateDocRef, (snapshot) => {
        if (snapshot.exists()) {
            const cloudData = snapshot.data();
            window.appState = { ...window.appState, ...cloudData };
        } else {
            pushState();
        }
        updateGlobalUI();
    }, (error) => {
        console.error("Erro no Sync:", error);
    });
};

const pushState = async () => {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const stateDocRef = doc(db, 'artifacts', appId, 'users', userId, 'state', 'current');
    const dataToSync = { ...window.appState };
    delete dataToSync.sidebarCollapsed; 
    try { 
        await setDoc(stateDocRef, dataToSync, { merge: true }); 
        return true; 
    } catch (e) { 
        return false; 
    }
};

// --- INJEÇÃO DE INTERFACE ---
const injectInterface = () => {
    // Unificação de placeholders (Suporta tanto sidebar-placeholder quanto menu-container)
    const sidebarPlaceholder = document.getElementById('sidebar-placeholder') || document.getElementById('menu-container');
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
            sub: [ { label: 'Extrato', target: 'extrato' } ]
        },
        { id: 'ajustes', label: 'Ajustes', icon: 'settings', color: 'text-slate-400' }
    ];
    
    const path = (window.location.pathname.split('/').pop() || 'dashboard.html').split('.')[0];
    const isCollapsed = window.appState.sidebarCollapsed;

    // Sidebar - Garante injeção limpa
    sidebarPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 overflow-hidden" style="width: ${isCollapsed ? '5rem' : '16rem'}">
            <div class="p-6 flex items-center justify-between overflow-hidden">
                <h1 class="text-2xl font-black text-blue-500 tracking-tighter ${isCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white mx-auto transition-colors">
                    <i data-lucide="menu" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="flex-1 px-3 mt-4 space-y-1 overflow-y-auto">
                ${items.map(i => {
                    const isActive = path === i.id || (i.sub && i.sub.some(s => path === s.target));
                    const clickAction = i.id === 'financas' ? "window.openTab('financas')" : (i.sub ? `window.toggleSubmenu('${i.id}')` : `window.openTab('${i.id}')`);
                    
                    return `
                    <div>
                        <button onclick="${clickAction}" 
                            class="w-full flex items-center justify-between px-4 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest 
                            ${isActive ? 'bg-white/5 text-blue-500' : 'text-slate-400 hover:bg-white/5'} transition-all">
                            <div class="flex items-center gap-4">
                                <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                                <span class="menu-label ${isCollapsed ? 'hidden' : 'block'}">${i.label}</span>
                            </div>
                            ${i.sub && !isCollapsed ? `<i data-lucide="chevron-right" id="arrow-${i.id}" class="w-3 h-3 transition-transform"></i>` : ''}
                        </button>
                        ${i.sub && !isCollapsed ? `
                            <div id="submenu-${i.id}" class="${i.sub.some(s => path === s.target) || path === i.id ? '' : 'hidden'} pl-12 mt-1 space-y-1">
                                ${i.sub.map(s => `<button onclick="window.openTab('${s.target}')" class="w-full text-left py-2 text-[9px] font-black uppercase tracking-widest ${path === s.target ? 'text-blue-500' : 'text-slate-500 hover:text-white'}">${s.label}</button>`).join('')}
                            </div>
                        ` : ''}
                    </div>`;
                }).join('')}
            </nav>
        </aside>
        
        <!-- Mobile Navigation -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-2 py-3 z-[100] shadow-2xl">
            ${items.filter(i => i.id !== 'ajustes').slice(0, 5).map(i => {
                const isActive = path === i.id || (i.sub && i.sub.some(s => path === s.target));
                return `<button onclick="window.openTab('${i.id}')" class="flex flex-col items-center gap-1 p-2 ${isActive ? 'text-blue-500' : 'text-slate-500'}">
                    <i data-lucide="${i.icon}" class="w-5 h-5"></i>
                    <span class="text-[7px] font-black uppercase tracking-widest">${i.label}</span>
                </button>`;
            }).join('')}
            <button onclick="window.openTab('ajustes')" class="flex flex-col items-center gap-1 p-2 ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}">
                <i data-lucide="settings" class="w-5 h-5"></i>
                <span class="text-[7px] font-black uppercase tracking-widest">Ajustes</span>
            </button>
        </nav>
    `;

    // Header Dinâmico
    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-transparent sticky top-0 z-40 px-6 py-2 flex items-center justify-end">
                <button onclick="window.openTab('veiculo')" class="w-12 h-12 rounded-2xl bg-orange-600/10 border border-orange-500/30 flex items-center justify-center text-orange-500 shadow-lg active:scale-95 transition-all pointer-events-auto">
                    <i data-lucide="fuel" class="w-6 h-6"></i>
                </button>
            </header>
        `;
    }
};

const updateGlobalUI = () => {
    injectInterface();
    const isCollapsed = window.appState.sidebarCollapsed;
    const mainContent = document.getElementById('main-content');
    
    if (mainContent && window.innerWidth >= 768) {
        mainContent.style.marginLeft = isCollapsed ? '5rem' : '16rem';
    }

    if (typeof refreshDisplays === 'function') refreshDisplays();
    if (typeof renderFullExtrato === 'function') renderFullExtrato();
    
    if (window.lucide) lucide.createIcons();
};

// --- LÓGICA DE DADOS (FINANÇAS) ---
window.getProjectionData = (mode) => {
    const now = new Date();
    const trans = window.appState.transacoes || [];
    let count = mode === '2026' ? 12 : parseInt(mode);
    let startMonth = mode === '2026' ? 0 : now.getMonth();
    let startYear = mode === '2026' ? 2026 : now.getFullYear();

    const labels = [];
    const income = [];
    const expenses = [];
    const balance = [];

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
        
        income.push(incVal);
        expenses.push(expVal);
        balance.push(incVal - expVal);
    }
    return { labels, income, expenses, balance };
};

// --- AÇÕES DO SISTEMA ---
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
    
    if (document.getElementById('fin-fixa')?.checked) {
        for (let i = 1; i < 12; i++) {
            const nextDate = new Date(venc + "T12:00:00");
            nextDate.setMonth(nextDate.getMonth() + i);
            window.appState.transacoes.push({ ...novaTransacao, id: Date.now() + i, vencimento: nextDate.toISOString().split('T')[0] });
        }
    }
    const ok = await pushState(); 
    if (ok) { window.showToast("Lançamento Efetuado!"); updateGlobalUI(); }
};

window.saveBikeEntry = async () => {
    const desc = document.getElementById('bike-log-desc')?.value;
    const km = parseInt(document.getElementById('bike-log-km')?.value);
    if (!desc || isNaN(km)) return false;
    window.appState.veiculo.km = km;
    window.appState.veiculo.historico.push({ id: Date.now(), desc: desc.toUpperCase(), km, valor: parseFloat(document.getElementById('bike-log-valor')?.value) || 0, data: new Date().toLocaleDateString('pt-BR'), tipo: document.getElementById('bike-log-tipo')?.value || 'Manutenção' });
    const ok = await pushState(); 
    if (ok) { window.showToast("Registro Salvo!"); updateGlobalUI(); return true; } 
    return false;
};

// --- UTILITÁRIOS ---
window.addWater = async (ml) => { window.appState.water_ml += ml; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast(`+${ml}ml Hidratado`); } };
window.addMonster = async () => { window.appState.energy_mg += window.appState.calibragem.monster_mg; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Energia Injetada!"); } };
window.resetHealthDay = async () => { window.appState.water_ml = 0; window.appState.energy_mg = 0; const ok = await pushState(); if (ok) { updateGlobalUI(); window.showToast("Ciclo Zerado"); } };
window.toggleSidebar = () => { 
    window.appState.sidebarCollapsed = !window.appState.sidebarCollapsed; 
    updateGlobalUI(); 
};
window.toggleSubmenu = (id) => {
    const sub = document.getElementById(`submenu-${id}`);
    const arrow = document.getElementById(`arrow-${id}`);
    if (sub) { 
        sub.classList.toggle('hidden'); 
        if (arrow) arrow.style.transform = sub.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(90deg)'; 
    }
};
window.openTab = (p) => { window.location.href = p + ".html"; };

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => { 
    initAuth();
    updateGlobalUI(); 
    window.addEventListener('resize', updateGlobalUI); 
});
