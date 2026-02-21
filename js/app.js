/**
 * PULSE OS - Central Intelligence
 * Handles sync, Global UI, Weather, NPS, Login and Flexible Sidebar.
 */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwVDkNFRuFNyTh3We_8qvlrSDIa3G_y1Owo_l8K47qmw_tlwv3I-EMBfRplkYX6EkMUQw/exec";
const NPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbcsfpw1_uglhD6JtF4jAvjJ4hqgnHTcgKL8CBtb_i6pRmck7POOBvuqYykjIIE9sLdyQ/exec";

const gasPrices = { "Fortaleza": 6.10, "Caucaia": 6.15, "São Paulo": 5.80, "Campinas": 5.95, "Rio de Janeiro": 6.40, "Niterói": 6.35 };

let appState = {
    login: "USER_PULSE",
    energy_mg: 0,
    water_ml: 0,
    sidebarCollapsed: false,
    perfil: { 
        peso: 70, altura: 170, idade: 25, sexo: 'M', estado: 'CE', cidade: 'Fortaleza', 
        alcoholStart: '', alcoholTitle: 'SEM ÁLCOOL', alcoholTarget: 30
    },
    veiculo: { 
        tipo: 'Moto', montadora: 'Yamaha', modelo: 'Fazer 250', consumo: 29, km: 35000, oleo: 38000, historico: [] 
    },
    tarefas: [],
    transacoes: [],
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud", desc: "carregando" }
};

let currentFilter = { month: new Date().getMonth() + 1, year: new Date().getFullYear(), viewMode: 'month' };
let autoSaveTimeout;

// --- LOGIN SYSTEM ---
window.doLogin = async () => {
    const userField = document.getElementById('login-user');
    const passField = document.getElementById('login-pass');
    const btn = document.getElementById('btn-login');
    const msg = document.getElementById('login-msg');

    if (!userField || !passField) return;

    const user = userField.value.trim();
    const pass = passField.value.trim();

    if (!user || !pass) {
        if(msg) msg.innerText = "Preencha todos os campos.";
        return;
    }

    if(btn) {
        btn.disabled = true;
        btn.innerText = "AUTENTICANDO...";
    }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: 'login', 
                user: user, 
                pass: pass 
            })
        });
        
        const result = await response.json();

        if (result.success) {
            appState.login = user;
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            if(msg) msg.innerText = "Usuário ou senha incorretos.";
            if(btn) {
                btn.disabled = false;
                btn.innerText = "ENTRAR";
            }
        }
    } catch (e) {
        console.error("Erro de login:", e);
        if(msg) msg.innerText = "Erro ao conectar. Verifique sua SCRIPT_URL.";
        if(btn) {
            btn.disabled = false;
            btn.innerText = "ENTRAR";
        }
    }
};

// --- WEATHER & NPS ---
const fetchWeather = async () => {
    try {
        const lat = -3.73; const lon = -38.52;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await response.json();
        const code = data.current_weather.weathercode;
        const temp = Math.round(data.current_weather.temperature);
        let icon = "sun";
        if (code === 0) icon = "sun";
        else if ([1, 2, 3].includes(code)) icon = "cloud-sun";
        else if ([51, 53, 55, 61, 63, 65].includes(code)) icon = "cloud-rain";
        else if ([95, 96, 99].includes(code)) icon = "cloud-lightning";
        else icon = "cloud";
        appState.weather = { temp, icon };
        const weatherEl = document.getElementById('header-weather-info');
        if (weatherEl) { 
            weatherEl.innerHTML = `<i data-lucide="${icon}" class="w-3 h-3"></i> ${temp}°C`; 
            if (window.lucide) lucide.createIcons(); 
        }
    } catch (e) {}
};

const fetchNPSData = async () => { 
    try { 
        const r = await fetch(NPS_SCRIPT_URL); 
        const d = await r.json(); 
        appState.nps_mes = d.nps || d.valor || d; 
        updateGlobalUI(); 
    } catch(e) { appState.nps_mes = "ERR"; } 
};

// --- SIDEBAR & UI INJECTION ---
window.toggleSidebar = () => {
    appState.sidebarCollapsed = !appState.sidebarCollapsed;
    saveLocalData();
    updateGlobalUI(); 
};

const adjustMainContentMargin = () => {
    const mainContent = document.querySelector('.flex-1.md\\:ml-64, .flex-1.md\\:ml-20');
    if (mainContent) {
        if (appState.sidebarCollapsed) {
            mainContent.classList.remove('md:ml-64');
            mainContent.classList.add('md:ml-20');
        } else {
            mainContent.classList.remove('md:ml-20');
            mainContent.classList.add('md:ml-64');
        }
    }
};

const injectInterface = () => {
    const navPlaceholder = document.getElementById('sidebar-placeholder');
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (!navPlaceholder) return;

    const currentPage = window.location.pathname.split('/').pop().split('.')[0] || 'dashboard';
    const isCollapsed = appState.sidebarCollapsed;
    const menuItems = [
        { id: 'dashboard', label: 'Home', icon: 'layout-dashboard' },
        { id: 'saude', label: 'Saúde', icon: 'activity' },
        { id: 'veiculo', label: 'Moto', icon: 'bike' },
        { id: 'work', label: 'WORK', icon: 'briefcase' },
        { id: 'financas', label: 'Money', icon: 'wallet' },
        { id: 'relatorio', label: 'Relatório', icon: 'bar-chart-3' }
    ];

    navPlaceholder.innerHTML = `
        <aside class="hidden md:flex flex-col ${isCollapsed ? 'w-20' : 'w-64'} bg-slate-900 border-r border-white/5 fixed h-full z-50 transition-all duration-300 overflow-hidden">
            <div class="p-6 flex items-center justify-between">
                <h1 class="text-2xl font-black tracking-tighter text-blue-500 italic ${isCollapsed ? 'hidden' : 'block'}">PULSE</h1>
                <button onclick="window.toggleSidebar()" class="p-2 rounded-xl bg-white/5 text-slate-500 hover:text-white transition-all">
                    <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-left'}" class="w-4 h-4"></i>
                </button>
            </div>
            <nav class="flex-1 px-3 space-y-2 mt-4">
                ${menuItems.map(item => `
                    <button onclick="window.openTab('${item.id}')" title="${item.label}" class="w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === item.id ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:bg-white/5'}">
                        <i data-lucide="${item.icon}" class="w-5 h-5 flex-shrink-0"></i> 
                        <span class="${isCollapsed ? 'hidden' : 'block'}">${item.label}</span>
                    </button>
                `).join('')}
            </nav>
            <div class="p-3 border-t border-white/5">
                <button onclick="window.openTab('ajustes')" title="Ajustes" class="w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest ${currentPage === 'ajustes' ? 'text-blue-500 bg-white/5' : 'text-slate-500 hover:bg-white/5'}">
                    <i data-lucide="settings" class="w-5 h-5 flex-shrink-0"></i>
                    <span class="${isCollapsed ? 'hidden' : 'block'}">Ajustes</span>
                </button>
            </div>
        </aside>
        
        <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-white/5 z-50 px-2 pb-safe">
            <div class="flex items-center justify-around h-16">
                ${menuItems.map(item => `<button onclick="window.openTab('${item.id}')" class="flex flex-col items-center justify-center gap-1 transition-all ${currentPage === item.id ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="${item.icon}" class="w-5 h-5"></i><span class="text-[8px] font-black uppercase tracking-tighter">${item.label}</span></button>`).join('')}
                <button onclick="window.openTab('ajustes')" class="flex flex-col items-center justify-center gap-1 transition-all ${currentPage === 'ajustes' ? 'text-blue-500' : 'text-slate-500'}"><i data-lucide="settings" class="w-5 h-5"></i><span class="text-[8px] font-black uppercase tracking-tighter">Ajustes</span></button>
            </div>
        </nav>

        <!-- Global Refuel Modal -->
        <div id="global-refuel-modal" class="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] hidden flex items-center justify-center p-4">
            <div class="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 p-8 space-y-6 relative italic shadow-2xl">
                <button onclick="window.closeRefuelModal()" class="absolute top-6 right-6 text-slate-500 hover:text-white"><i data-lucide="x" class="w-6 h-6"></i></button>
                <div class="flex items-center gap-3 text-emerald-500">
                    <i data-lucide="fuel" class="w-6 h-6"></i>
                    <h3 class="text-xl font-black uppercase tracking-tighter leading-none italic">Lançar Abastecimento</h3>
                </div>
                <div class="grid grid-cols-2 gap-3 italic">
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Data</label><input type="date" id="m-refuel-date" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">KM Atual</label><input type="number" id="m-refuel-km" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                </div>
                <div class="space-y-1 italic"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Posto / Local</label><input type="text" id="m-refuel-desc" placeholder="EX: POSTO IPIRANGA" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none uppercase italic"></div>
                <div class="grid grid-cols-3 gap-2 italic">
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Preço/L</label><input type="number" id="m-refuel-price" step="0.001" oninput="window.calcRefuelModal('preco')" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-emerald-500 outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Litros</label><input type="number" id="m-refuel-liters" step="0.01" oninput="window.calcRefuelModal('litros')" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-blue-400 outline-none italic"></div>
                    <div class="space-y-1"><label class="text-[8px] font-black uppercase text-slate-600 px-2 italic">Total R$</label><input type="number" id="m-refuel-total" step="0.01" oninput="window.calcRefuelModal('total')" class="w-full p-4 bg-slate-950 border border-white/5 rounded-2xl text-xs font-bold text-white outline-none italic"></div>
                </div>
                <button onclick="window.confirmGlobalRefuel()" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] transition-all shadow-2xl active:scale-[0.98] italic">Confirmar Lançamento</button>
            </div>
        </div>
    `;

    if (headerPlaceholder) {
        headerPlaceholder.innerHTML = `
            <header class="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 px-6 py-5 flex items-center justify-between border-b border-white/5">
                <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 flex items-center gap-2 italic">
                    ${currentPage.toUpperCase()} <span class="text-slate-800">•</span>
                    <span class="text-blue-500">${appState.perfil.cidade.toUpperCase()}</span> <span class="text-slate-800">•</span>
                    <span id="header-weather-info" class="text-slate-400 flex items-center gap-1">
                        <i data-lucide="${appState.weather.icon}" class="w-3 h-3"></i> ${appState.weather.temp}°C
                    </span>
                </h2>
                <div class="flex items-center gap-3">
                    <button onclick="window.openRefuelModal()" class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 active:scale-95 transition-all">
                        <i data-lucide="fuel" class="w-5 h-5"></i>
                    </button>
                </div>
            </header>
        `;
    }
};

// --- CORE ACTIONS ---
window.addWater = (ml) => { appState.water_ml += ml; saveLocalData(); saveCloudData(); updateGlobalUI(); };
window.addMonster = () => { appState.energy_mg += 160; appState.transacoes.push({ id: Date.now(), tipo: 'despesa', cat: 'Saúde', desc: 'Monster Energy', valor: 10, data: getTodayFormatted(), efetivada: true }); saveLocalData(); saveCloudData(); updateGlobalUI(); };
window.failChallenge = () => { const o = document.getElementById('panic-overlay'); if(o){o.classList.remove('hidden'); setTimeout(()=>o.classList.add('hidden'), 3000);} appState.perfil.alcoholStart = new Date().toISOString().split('T')[0]; saveLocalData(); saveCloudData(); updateGlobalUI(); };

window.openRefuelModal = () => { document.getElementById('global-refuel-modal').classList.remove('hidden'); document.getElementById('m-refuel-date').value = new Date().toISOString().split('T')[0]; document.getElementById('m-refuel-km').value = appState.veiculo.km; };
window.closeRefuelModal = () => document.getElementById('global-refuel-modal').classList.add('hidden');
window.calcRefuelModal = (o) => { const p=parseFloat(document.getElementById('m-refuel-price').value)||0, l=parseFloat(document.getElementById('m-refuel-liters').value)||0, t=parseFloat(document.getElementById('m-refuel-total').value)||0; if(o==='preco'||o==='total'){if(p>0&&t>0) document.getElementById('m-refuel-liters').value=(t/p).toFixed(2);} else if(o==='litros'){if(p>0&&l>0) document.getElementById('m-refuel-total').value=(l*p).toFixed(2);} };
window.confirmGlobalRefuel = () => { const d=document.getElementById('m-refuel-date').value, k=parseInt(document.getElementById('m-refuel-km').value)||0, t=parseFloat(document.getElementById('m-refuel-total').value)||0, l=document.getElementById('m-refuel-liters').value; if(t<=0)return; appState.veiculo.historico.push({id:Date.now(),tipo:'Abastecimento',sub:'Combustível',data:formatInputDate(d),km:k,valor:t,detalhes:`${l}L`}); if(k>appState.veiculo.km) appState.veiculo.km=k; appState.transacoes.push({id:Date.now()+1,tipo:'despesa',cat:'Veículo',desc:'Abastecimento',valor:t,data:formatInputDate(d),efetivada:true}); saveLocalData(); saveCloudData(); updateGlobalUI(); window.closeRefuelModal(); };

// --- UI UPDATE & SYNC ---
const updateGlobalUI = () => {
    const p=appState.perfil, v=appState.veiculo;
    const wGoal=p.peso*35, eLimit=400;
    const sEfet=appState.transacoes.filter(t=>t.efetivada).reduce((a,t)=>a+(t.tipo==='receita'?t.valor:-t.valor),0);
    const fRot=appState.transacoes.filter(t=>t.cat==='Veículo'&&t.tipo==='receita').reduce((a,t)=>a+t.valor,0);
    const update = (id,v) => { const el=document.getElementById(id); if(el)el.innerText=v; };
    
    injectInterface();
    adjustMainContentMargin();
    
    update('dash-saldo', sEfet.toLocaleString('pt-BR'));
    update('dash-fundo', fRot.toLocaleString('pt-BR'));
    update('dash-water-cur', appState.water_ml);
    update('dash-water-goal', wGoal);
    update('dash-energy-val', appState.energy_mg);
    update('dash-nps-val', appState.nps_mes);
    update('dash-km-atual', v.km.toLocaleString());

    const wBar=document.getElementById('dash-water-bar'); if(wBar) wBar.style.width=`${Math.min((appState.water_ml/wGoal)*100,100)}%`;
    const circ=document.getElementById('energy-gauge-path'); if(circ){ const pct=Math.min((appState.energy_mg/eLimit)*100,100), r=36, c=2*Math.PI*r; circ.style.strokeDasharray=`${c} ${c}`; circ.style.strokeDashoffset=c-(pct/100)*c; }
    if(p.alcoholStart&&document.getElementById('alcohol-bar')){ const s=new Date(p.alcoholStart+'T00:00:00'), d=Math.min(Math.floor((new Date()-s)/(1000*60*60*24)),p.alcoholTarget); update('alcohol-days-count',Math.max(d,0)); update('alcohol-target-display',p.alcoholTarget); document.getElementById('alcohol-bar').style.width=`${(d/p.alcoholTarget)*100}%`; }

    if(document.getElementById('fin-history-list')) renderFinances();
    if(document.getElementById('work-task-active-list')) renderWork();
    if(document.getElementById('bike-history-list')) renderVeiculo();
    if(window.location.pathname.includes('ajustes')) fillSettingsForm();
    if(window.lucide) lucide.createIcons();
};

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));
const loadLocalData = () => { const s=localStorage.getItem('pulse_state'); if(s) appState=JSON.parse(s); };
const saveCloudData = async () => { try { await fetch(SCRIPT_URL, {method:'POST', mode:'no-cors', body:JSON.stringify({action:'syncData', userId:appState.login, data:appState})}); } catch(e){} };

window.savePulseSettings = (isAuto=false) => {
    const p=appState.perfil, v=appState.veiculo, get=(id)=>document.getElementById(id)?.value;
    if(document.getElementById('set-peso')){ p.peso=parseFloat(get('set-peso'))||p.peso; p.cidade=get('set-cidade')||p.cidade; p.estado=get('set-estado')||p.estado; v.montadora=get('set-bike-montadora')||v.montadora; v.modelo=get('set-bike-modelo')||v.modelo; v.consumo=parseFloat(get('set-bike-consumo'))||v.consumo; v.km=parseInt(get('set-bike-km'))||v.km; v.oleo=parseInt(get('set-bike-oleo'))||v.oleo; p.alcoholTitle=get('set-prop-title')||p.alcoholTitle; p.alcoholTarget=parseInt(get( 'set-prop-target'))||p.alcoholTarget; p.alcoholStart=get('set-prop-start')||p.alcoholStart; }
    saveLocalData(); clearTimeout(autoSaveTimeout); autoSaveTimeout=setTimeout(saveCloudData, 2000);
    if(!isAuto) updateGlobalUI();
};

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    fetchNPSData();
    fetchWeather();
    if(window.location.pathname.includes('ajustes')){ document.querySelectorAll('input, select').forEach(el=>{el.addEventListener('input',()=>window.savePulseSettings(true));}); }
});

window.openTab = (p) => { window.location.href = p + ".html"; };