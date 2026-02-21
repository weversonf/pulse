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
    perfil: { peso: 80, altura: 175, cidade: 'Fortaleza', alcoholStart: '', alcoholTarget: 30 },
    veiculo: { tipo: 'Moto', modelo: 'Fazer 250', km: 35000, historico: [] },
    tarefas: [],
    transacoes: [], // Cache local para exibição rápida
    nps_mes: "...",
    weather: { temp: "--", icon: "cloud" }
};

// --- SINCRONIZAÇÃO E PERSISTÊNCIA ---

const saveLocalData = () => localStorage.setItem('pulse_state', JSON.stringify(appState));

const loadLocalData = () => {
    const saved = localStorage.getItem('pulse_state');
    if (saved) appState = { ...appState, ...JSON.parse(saved) };
};

// Salva o "Backup" JSON na aba Dados
const saveCloudBackup = async () => {
    saveLocalData();
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'syncData', userId: appState.login, data: appState })
        });
    } catch (e) { console.warn("PULSE: Erro no backup cloud."); }
};

// SALVAMENTO ESPECÍFICO NA ABA "FINANCAS" (LINHA POR LINHA)
const saveToFinancasSheet = async (transacao) => {
    if (!appState.login) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'appendFinanca', 
                userId: appState.login, 
                rowData: [
                    transacao.id,
                    transacao.data,
                    transacao.tipo,
                    transacao.cat,
                    transacao.desc,
                    transacao.valor
                ]
            })
        });
        console.log("PULSE: Transação salva na aba Financas.");
    } catch (e) { console.error("Erro ao salvar linha na aba Financas", e); }
};

// --- SISTEMA DE LOGIN ---

window.doLogin = async () => {
    const user = document.getElementById('login-user')?.value.trim();
    const pass = document.getElementById('login-pass')?.value.trim();
    const msg = document.getElementById('login-msg');
    const btn = document.getElementById('btn-login');

    if (!user || !pass) return;
    if(btn) { btn.disabled = true; btn.innerText = "AUTENTICANDO..."; }

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', user, pass })
        });
        const result = await response.json();

        if (result.success) {
            appState.login = user;
            if (result.data) appState = { ...appState, ...result.data };
            saveLocalData();
            window.location.href = "dashboard.html";
        } else {
            if(msg) msg.innerText = "Acesso Negado.";
            if(btn) { btn.disabled = false; btn.innerText = "ENTRAR"; }
        }
    } catch (e) {
        if(msg) msg.innerText = "Erro de conexão.";
        if(btn) { btn.disabled = false; btn.innerText = "ENTRAR"; }
    }
};

// --- LANÇAMENTOS FINANCEIROS ---

window.lancarFinanca = async (tipo) => {
    const valor = parseFloat(document.getElementById('fin-valor')?.value);
    const desc = document.getElementById('fin-desc')?.value.trim();
    const cat = document.getElementById('fin-categoria')?.value;
    const dataInput = document.getElementById('fin-data')?.value;

    if (!valor || !desc) return;

    const dataFormatada = dataInput ? dataInput.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');

    const novaTransacao = {
        id: Date.now(),
        tipo: tipo === 'receita' ? 'Receita' : 'Despesa',
        cat,
        desc: desc.toUpperCase(),
        valor,
        data: dataFormatada
    };

    // 1. Atualiza localmente
    appState.transacoes.push(novaTransacao);
    updateGlobalUI();

    // 2. Salva linha na aba "Financas" (O que você pediu)
    await saveToFinancasSheet(novaTransacao);

    // 3. Salva backup JSON
    saveCloudBackup();

    if (document.getElementById('fin-valor')) document.getElementById('fin-valor').value = "";
    if (document.getElementById('fin-desc')) document.getElementById('fin-desc').value = "";
};

// --- LANÇAMENTOS DE VEÍCULO (AGORA VAI PARA ABA FINANÇAS TAMBÉM) ---

window.lancarVeiculo = async () => {
    const tipoServico = document.getElementById('v-tipo-principal')?.value;
    const km = parseInt(document.getElementById('v-km-atual')?.value) || 0;
    const valor = parseFloat(document.getElementById('v-total-rs')?.value) || 0;
    const desc = document.getElementById('v-descricao')?.value || "";
    const dataInput = document.getElementById('v-data')?.value;

    if (!km || !valor) return;

    const dataFormatada = dataInput ? dataInput.split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR');

    // Objeto para aba Veiculo_Log (JSON)
    const novoLogVeiculo = { id: Date.now(), tipo: tipoServico, data: dataFormatada, km, valor, detalhes: desc };
    appState.veiculo.historico.push(novoLogVeiculo);
    appState.veiculo.km = Math.max(appState.veiculo.km, km);

    // Objeto para aba FINANÇAS (O que você pediu)
    const transacaoFinanceira = {
        id: Date.now() + 1,
        tipo: 'Despesa',
        cat: 'Veículo',
        desc: `${tipoServico.toUpperCase()}: ${desc.toUpperCase()} (KM: ${km})`,
        valor,
        data: dataFormatada
    };

    appState.transacoes.push(transacaoFinanceira);
    updateGlobalUI();

    // 1. Salva na aba "Financas" linha por linha
    await saveToFinancasSheet(transacaoFinanceira);

    // 2. Salva backup JSON
    saveCloudBackup();
};

// --- INTERFACE E APOIO ---

window.addWater = (ml) => { appState.water_ml += ml; updateGlobalUI(); saveCloudBackup(); };
window.addMonster = () => { 
    appState.energy_mg += 160; 
    const t = { id: Date.now(), tipo: 'Despesa', cat: 'Saúde', desc: 'MONSTER ENERGY', valor: 10, data: new Date().toLocaleDateString('pt-BR') };
    appState.transacoes.push(t);
    saveToFinancasSheet(t);
    updateGlobalUI(); 
    saveCloudBackup(); 
};

window.toggleSidebar = () => { appState.sidebarCollapsed = !appState.sidebarCollapsed; saveLocalData(); updateGlobalUI(); };

const updateGlobalUI = () => {
    if (typeof injectInterface === 'function') injectInterface();
    const main = document.getElementById('main-content');
    if (main && window.innerWidth >= 768) {
        main.classList.toggle('md:ml-64', !appState.sidebarCollapsed);
        main.classList.toggle('md:ml-20', appState.sidebarCollapsed);
    }
    
    const update = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    update('dash-water-cur', appState.water_ml);
    update('dash-energy-val', appState.energy_mg);
    update('dash-nps-val', appState.nps_mes);
    update('water-current-display', appState.water_ml);
    update('energy-current-display', appState.energy_mg);
    update('bike-km-display', appState.veiculo.km);

    if (window.lucide) lucide.createIcons();
};

window.openTab = (p) => { window.location.href = p + ".html"; };

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    updateGlobalUI();
    if (!window.location.pathname.includes('index')) {
        // fetchWeather e NPS omitidos por brevidade
    }
});
