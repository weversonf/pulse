/**
 * PULSE OS - Central Intelligence
 * Sincronização: JSON Global (Aba Dados) + Transações Linha a Linha (Aba Financas)
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

let appState = {
    login: "",
    energy_mg: 0,
    water_ml: 0,
    sidebarCollapsed: false,
    perfil: { peso: 80, altura: 175, cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30, alcoholTitle: 'SEM ÁLCOOL' },
    veiculo: { tipo: 'Moto', montadora: 'YAMAHA', modelo: 'FAZER 250', consumo: 29, km: 35000, oleo: 38000, historico: [] },
    tarefas: [],
    transacoes: [],
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud", color: "text-slate-400" }
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) {
        try {
            appState = { ...appState, ...JSON.parse(saved) };
        } catch (e) { console.error("PULSE: Erro local."); }
    }
};

const saveCloudBackup = async () => {
    saveLocalData();
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.warn("PULSE: Cloud off."); }
};

const saveToFinancasSheet = async (transacao) => {
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'appendFinanca', 
                userId: appState.login, 
                rowData: [transacao.id, transacao.data, transacao.tipo, transacao.cat, transacao.desc, transacao.valor]
            })
        });
    } catch (e) { console.error("Finanças off."); }
};

const refreshFromCloud = async () => {
    if (!appState.login) return;
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user: appState.login, pass: "REFRESH" })
        });
        const result = await response.json();
        if (result.success && result.data) {
            appState = { ...appState, ...result.data };
            updateGlobalUI();
        }
    } catch (e) { console.error("Refresh off."); }
};

// --- CLIMA FORTALEZA ---

const fetchWeather = async () => {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=-3.73&longitude=-38.52&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        
        let icon = 'cloud';
        let color = 'text-blue-300';
        
        if (code <= 1) { icon = 'sun'; color = 'text-yellow-400'; }
        else if (code <= 3) { icon = 'cloud-sun'; color = 'text-orange-400'; }
        else if (code >= 51 && code <= 67) { icon = 'cloud-rain'; color = 'text-blue-400'; }
        else if (code >= 95) { icon = 'zap'; color = 'text-yellow-600'; }

        appState.weather = { temp: Math.round(data.current_weather.temperature), icon, color };
        updateGlobalUI();
    } catch (e) {}
};

// --- LIGHTBOX (MODAL) ABASTECIMENTO ---

window.openFuelModal = () => {
    let modal = document.getElementById('fuel-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fuel-modal-overlay';
        modal.className = 'fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-[#020617] border border-white/5 w-full max-w-xl p-6 rounded-[2rem] shadow-2xl relative italic">
            <div class="flex items-center gap-2 mb-6">
                <i data-lucide="plus-circle" class="w-4 h-4 text-orange-500"></i>
                <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500 italic">Novo Lançamento</h3>
            </div>

            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <select id="m-v-tipo" class="w-full p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none uppercase italic">
                        <option value="Abastecimento">Abastecimento</option>
                        <option value="Serviço">Serviço ou Manutenção</option>
                    </select>
                    <input type="date" id="m-v-data" value="${new Date().toISOString().split('T')[0]}" class="w-full p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-slate-400 outline-none italic">
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <input type="number" id="m-v-km-atual" value="${appState.veiculo.km}" placeholder="KM ATUAL" class="w-full p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic uppercase">
                    <input type="text" id="m-v-desc" placeholder="POSTO OU LOCAL..." class="w-full p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic uppercase">
                </div>

                <select id="m-v-comb-tipo" class="w-full p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none uppercase italic">
                    <option value="Gasolina Comum">Gasolina Comum</option>
                    <option value="Gasolina Aditivada">Gasolina Aditivada</option>
                    <option value="Etanol">Etanol</option>
                </select>

                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Preço/L</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 text-xs font-bold">R$</span>
                            <input type="number" id="m-v-preco" step="0.001" oninput="window.calcFuelModal('preco')" placeholder="0,00" class="w-full p-4 pl-10 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-emerald-500 outline-none italic">
                        </div>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Litros</label>
                        <div class="relative">
                            <input type="number" id="m-v-litros" step="0.01" oninput="window.calcFuelModal('litros')" placeholder="0.00" class="w-full p-4 pr-10 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-blue-400 outline-none italic">
                            <span class="absolute right-4 top-1/2 -translate-y-1/2 text-blue-400 text-xs font-bold uppercase">L</span>
                        </div>
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Valor Total R$</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-white text-xs font-bold">R$</span>
                        <input type="number" id="m-v-total" step="0.01" oninput="window.calcFuelModal('total')" placeholder="0,00" class="w-full p-4 pl-10 bg-slate-900 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic">
                    </div>
                </div>

                <div class="flex gap-2 mt-4">
                   <button onclick="window.closeFuelModal()" class="flex-1 bg-slate-900 text-slate-500 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all hover:text-white italic">Cancelar</button>
                   <button onclick="window.saveFuelModal()" class="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-900/20 transition-all active:scale-95 italic">Confirmar Lançamento</button>
                </div>
            </div>
        </div>
    `;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    if (window.lucide) window.lucide.createIcons();
};

window.closeFuelModal = () => {
    const modal = document.getElementById('fuel-modal-overlay');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
};

window.calcFuelModal = (src) => {
    const p = parseFloat(document.getElementById('m-v-preco')?.value) || 0;
    const l = parseFloat(document.getElementById('m-v-litros')?.value) || 0;
    const t = parseFloat(document.getElementById('m-v-total')?.value) || 0;

    if (src === 'preco' || src === 'total') {
        if (p > 0 && t > 0) document.getElementById('m-v-litros').value = (t / p).toFixed(2);
    } else if (src === 'litros') {
        if (p > 0 && l > 0) document.getElementById('m-v-total').value = (l * p).toFixed(2);
    }
};

window.saveFuelModal = async () => {
    const km = parseInt(document.getElementById('m-v-km-atual')?.value) || 0;
    const val = parseFloat(document.getElementById('m-v-total')?.value) || 0;
    const date = document.getElementById('m-v-data')?.value;
    const desc = document.getElementById('m-v-desc')?.value.trim() || "ABASTECIMENTO";
    const tipo = document.getElementById('m-v-tipo')?.value;
    const comb = document.getElementById('m-v-comb-tipo')?.value;

    if (!km || !val) return;

    const formattedDate = date ? date.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');
    
    const log = { id: Date.now(), tipo, data: formattedDate, km, valor: val, detalhes: `${comb} - ${desc.toUpperCase()}` };
    appState.veiculo.historico.push(log);
    appState.veiculo.km = Math.max(appState.veiculo.km, km);

    const fin = { id: Date.now() + 1, tipo: 'Despesa', cat: 'Transporte', desc: `${tipo.toUpperCase()} (${comb}): ${desc.toUpperCase()} (KM: ${km})`, valor: val, data: formattedDate };
    appState.transacoes.push(fin);

    updateGlobalUI();
    await saveToFinancasSheet(fin);
    saveCloudBackup();
    window.closeFuelModal();
};

// --- MODAL DE RESET DE DADOS ---

window.openResetModal = () => {
    let modal = document.getElementById('reset-modal-overlay');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reset-modal-overlay';
        modal.className = 'fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-slate-900 border border-red-500/20 w-full max-w-md p-8 rounded-[3rem] shadow-2xl relative italic">
            <div class="flex items-center gap-3 mb-6">
                <i data-lucide="alert-triangle" class="w-6 h-6 text-red-500"></i>
                <h3 class="text-xl font-black tracking-tighter text-white uppercase italic leading-none">Zerar Dados</h3>
            </div>
            
            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8 italic">
                Atenção: Esta ação é irreversível. Escolha quais informações deseja remover permanentemente do sistema.
            </p>

            <div class="space-y-3">
                <button onclick="window.resetData('finance_vehicle')" class="w-full bg-slate-950 border border-white/5 hover:border-orange-500/30 p-5 rounded-3xl flex items-center justify-between transition-all group active:scale-95 italic">
                    <div class="text-left">
                        <p class="text-xs font-black uppercase text-white leading-none">Finanças e Veículo</p>
                        <p class="text-[7px] font-bold text-slate-500 uppercase tracking-tighter mt-1 italic">Limpa extratos, histórico e KM</p>
                    </div>
                    <i data-lucide="wallet" class="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform"></i>
                </button>

                <button onclick="window.resetData('all')" class="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600 p-5 rounded-3xl flex items-center justify-between transition-all group active:scale-95 text-red-500 hover:text-white italic">
                    <div class="text-left">
                        <p class="text-xs font-black uppercase leading-none">Zerar Tudo</p>
                        <p class="text-[7px] font-bold opacity-60 uppercase tracking-tighter mt-1 italic">Reseta saúde, tarefas e biometria</p>
                    </div>
                    <i data-lucide="trash-2" class="w-4 h-4 group-hover:scale-110 transition-transform"></i>
                </button>

                <button onclick="window.closeResetModal()" class="w-full py-4 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 hover:text-slate-200 transition-all italic mt-4">
                    Cancelar
                </button>
            </div>
        </div>
    `;

    modal.classList.remove('opacity-0', 'pointer-events-none');
    if (window.lucide) window.lucide.createIcons();
};

window.closeResetModal = () => {
    const modal = document.getElementById('reset-modal-overlay');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
};

window.resetData = async (type) => {
    if (type === 'finance_vehicle') {
        appState.transacoes = [];
        appState.veiculo.historico = [];
        appState.veiculo.km = 35000;
        appState.veiculo.oleo = 38000;
    } else if (type === 'all') {
        appState.energy_mg = 0;
        appState.water_ml = 0;
        appState.tarefas = [];
        appState.transacoes = [];
        appState.veiculo.historico = [];
        appState.veiculo.km = 35000;
        appState.perfil = { peso: 80, altura: 175, cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30, alcoholTitle: 'SEM ÁLCOOL' };
    }

    updateGlobalUI();
    saveCloudBackup();
    window.closeResetModal();
    
    // Feedback visual rápido
    const main = document.getElementById('main-content');
    if (main) {
        main.style.opacity = '0.3';
        setTimeout(() => main.style.opacity = '1', 500);
    }
};

// --- WORK LOGIC ---

window.addWorkTask = () => {
    const titleEl = document.getElementById('work-task-title');
    if (!titleEl || !titleEl.value.trim()) return;
    const task = {
        id: Date.now(),
        title: titleEl.value.trim().toUpperCase(),
        type: document.getElementById('work-task-type')?.value || "Geral",
        requester: document.getElementById('work-task-requester')?.value.trim().toUpperCase() || "EU",
        deadline: document.getElementById('work-task-deadline')?.value || "",
        status: 'Pendente'
    };
    appState.tarefas.push(task);
    titleEl.value = "";
    updateGlobalUI();
    saveCloudBackup();
};

window.toggleTask = (id) => {
    const task = appState.tarefas.find(t => t.id === id);
    if (task) { task.status = task.status === 'Pendente' ? 'Concluído' : 'Pendente'; updateGlobalUI(); saveCloudBackup(); }
};

const renderWorkTasks = () => {
    const list = document.getElementById('work-task-active-list');
    if (!list) return;
    const sorted = [...appState.tarefas].sort((a,b) => (a.status === 'Concluído' ? 1 : -1));
    list.innerHTML = sorted.map(t => `
        <div class="glass-card p-5 rounded-3xl flex items-center justify-between transition-all ${t.status === 'Concluído' ? 'opacity-40' : ''}">
            <div class="flex items-center gap-4">
                <button onclick="window.toggleTask(${t.id})" class="w-6 h-6 rounded-lg border-2 ${t.status === 'Concluído' ? 'bg-blue-500 border-blue-500' : 'border-white/10'} flex items-center justify-center">
                    ${t.status === 'Concluído' ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}
                </button>
                <div>
                    <p class="text-xs font-black uppercase italic ${t.status === 'Concluído' ? 'line-through' : 'text-white'}">${t.title}</p>
                    <p class="text-[8px] font-bold text-slate-500 uppercase italic mt-0.5">${t.type} • ${t.requester} • ${t.deadline || 'S/ DATA'}</p>
                </div>
            </div>
            <button onclick="appState.tarefas = appState.tarefas.filter(x => x.id !== ${t.id}); updateGlobalUI(); saveCloudBackup();" class="text-slate-700 hover:text-red-500 transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `).join('');
};

// --- INTERFACE (INJECT) ---

const injectInterface = () => {
    const sidebar = document.getElementById('sidebar-placeholder');
    const header = document.getElementById('header-placeholder');
    if (!sidebar) return;

    const path = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
    const isColl = appState.sidebarCollapsed;
    
    const items = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard', color: 'text-blue-500' },
        { id: 'saude', label: 'Saúde', icon: 'activity', color: 'text-rose-500' },
        { id: 'veiculo', label: 'Moto', icon: 'bike', color: 'text-orange-500' },
        { id: 'work', label: 'WORK', icon: 'briefcase', color: 'text-sky-400' },
        { id: 'financas', label: 'Money', icon: 'wallet', color: 'text-emerald-500' }
    ];

    sidebar.innerHTML = `
        <aside class="hidden md:flex flex-col ${isColl ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 italic">
            <div class="p-6 flex items-center justify-between">
                <h1 class="text-2xl font-black text-blue-500 italic ${isColl ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 bg-white/5 rounded-xl text-slate-500 hover:text-white">
                    <i data-lucide="${isColl ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="flex-1 px-3 space-y-2 mt-4">
                ${items.map(i => `
                    <button onclick="window.openTab('${i.id}')" class="w-full flex items-center ${isColl ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${path === i.id ? 'bg-white/5 text-blue-500' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                        <span class="${isColl ? 'hidden' : 'block'} ml-3">${i.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="p-3 border-t border-white/5">
                <button onclick="window.openTab('ajustes')" class="w-full flex items-center ${isColl ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500 hover:bg-white/5'}">
                    <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
                    <span class="${isColl ? 'hidden' : 'block'} ml-3">Ajustes</span>
                </button>
            </div>
        </aside>
        <!-- Mobile Nav -->
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/10 z-[60] px-2 h-16 flex items-center justify-around">
            ${items.map(i => `
                <button onclick="window.openTab('${i.id}')" class="flex flex-col items-center transition-all ${path === i.id ? 'text-blue-500' : 'text-slate-500'}">
                    <i data-lucide="${i.icon}" class="w-5 h-5 ${i.color}"></i>
                    <span class="text-[7px] font-black uppercase tracking-tighter">${i.label}</span>
                </button>
            `).join('')}
            <button onclick="window.openTab('ajustes')" class="flex flex-col items-center ${path === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}">
                <i data-lucide="settings" class="w-5 h-5 text-slate-400"></i>
                <span class="text-[7px] font-black uppercase tracking-tighter">SET</span>
            </button>
        </nav>
    `;

    if (header) {
        header.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5 italic">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2">
                    ${path.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500">${(appState.perfil.cidade || 'FORTALEZA').toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span class="flex items-center gap-1 italic text-white font-black">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3 ${appState.weather.color}"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <button onclick="window.openFuelModal()" class="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 active:scale-90 transition-all shadow-lg shadow-orange-950/20">
                    <i data-lucide="fuel" class="w-5 h-5"></i>
                </button>
            </header>
        `;
    }
};

const updateGlobalUI = () => {
    injectInterface();
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.classList.toggle('md:ml-64', !appState.sidebarCollapsed);
        main.classList.toggle('md:ml-20', appState.sidebarCollapsed);
    }
    
    const update = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    update('dash-water-cur', appState.water_ml);
    update('dash-energy-val', appState.energy_mg);
    update('water-current-display', appState.water_ml);
    update('energy-current-display', appState.energy_mg);
    update('bike-km-display', appState.veiculo.km);
    update('task-count', appState.tarefas.filter(t => t.status === 'Pendente').length);

    const wPct = Math.min((appState.water_ml / 3500) * 100, 100);
    const ePct = Math.min((appState.energy_mg / 400) * 100, 100);
    ['dash-water-bar', 'water-bar'].forEach(id => { if(document.getElementById(id)) document.getElementById(id).style.width = wPct + '%'; });
    if(document.getElementById('energy-bar')) document.getElementById('energy-bar').style.width = ePct + '%';
    
    const gauge = document.getElementById('energy-gauge-path');
    if (gauge) gauge.style.strokeDashoffset = 226.2 - (ePct / 100) * 226.2;

    const saldo = appState.transacoes.reduce((acc, t) => acc + (t.tipo === 'Receita' ? t.valor : -t.valor), 0);
    update('dash-saldo', saldo.toLocaleString('pt-BR'));
    update('fin-saldo-atual-pag', saldo.toLocaleString('pt-BR'));

    renderWorkTasks();
    const bikeList = document.getElementById('bike-history-list');
    if (bikeList) {
        const history = [...appState.veiculo.historico].sort((a, b) => b.id - a.id);
        bikeList.innerHTML = history.map(h => `
            <div class="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-center justify-between group transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-orange-500/10 text-orange-500 rounded-xl flex items-center justify-center">
                        <i data-lucide="${h.tipo === 'Abastecimento' ? 'fuel' : 'wrench'}"></i>
                    </div>
                    <div>
                        <p class="text-xs font-black uppercase italic text-white">${h.tipo}</p>
                        <p class="text-[8px] font-bold text-slate-500 uppercase italic mt-0.5">${h.data} • ${h.km} KM • R$ ${h.valor.toFixed(2)}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-[8px] font-black text-slate-500 uppercase italic">${h.detalhes}</p>
                </div>
            </div>
        `).join('');
    }

    setTimeout(() => { if (window.lucide) window.lucide.createIcons(); }, 50);
};

window.openTab = (p) => { window.location.href = p + ".html"; };
window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    fetchWeather();
    if (!window.location.pathname.includes('index')) refreshFromCloud();
});
