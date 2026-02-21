<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PULSE OS - WORK</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link rel="stylesheet" href="css/style.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,900;1,900&display=swap');
        
        body { 
            font-family: 'Inter', sans-serif; 
            -webkit-tap-highlight-color: transparent; 
            background-color: #020617;
        }

        .transition-all { transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1); }

        /* Container principal para controle de margem via app.js */
        #main-content {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Espaçamento seguro para mobile (Bottom Nav) */
        .pb-mobile-nav { padding-bottom: 5rem; }
        @media (max-width: 768px) { .pb-mobile-nav { padding-bottom: 5rem; } }
        @media (min-width: 768px) { .pb-mobile-nav { padding-bottom: 0; } }

        .glass-card {
            background: rgba(15, 23, 42, 0.4);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Suavização de hover nas tarefas */
        .task-row .action-buttons { opacity: 0; transition: all 0.2s ease; }
        .task-row:hover .action-buttons { opacity: 1; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 italic">
    <div class="flex min-h-screen relative">
        <!-- Placeholder para a Navegação (Injetada pelo app.js) -->
        <div id="sidebar-placeholder"></div>

        <!-- Conteúdo Principal com ID para controle de margem -->
        <div id="main-content" class="flex-1 md:ml-64 transition-all duration-300 pb-mobile-nav">
            
            <!-- Placeholder para o Cabeçalho Dinâmico (Injetado pelo app.js) -->
            <div id="header-placeholder"></div>

            <main class="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
                <!-- Branding Card -->
                <div class="glass-card p-8 rounded-[2.5rem] italic">
                    <div class="flex items-center gap-2 text-sky-400 mb-3 opacity-80 italic">
                        <i data-lucide="briefcase" class="w-4 h-4"></i>
                        <p class="text-[10px] font-black uppercase tracking-[0.4em] italic">MAKRO ENGENHARIA</p>
                    </div>
                    <p class="text-5xl font-black tracking-tighter text-white leading-none italic uppercase">Atividades</p>
                </div>

                <!-- Formulário de Lançamento -->
                <div class="glass-card p-6 rounded-[2.5rem] space-y-3 italic">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 italic">
                        <input type="text" id="work-task-title" placeholder="O QUE PRECISA SER FEITO?" class="w-full p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-xs font-bold text-slate-300 outline-none uppercase italic focus:border-sky-500/30 transition-all">
                        <select id="work-task-type" class="w-full p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-xs font-bold text-slate-300 outline-none uppercase italic">
                            <option value="Operacional">Operacional</option>
                            <option value="Engenharia">Engenharia</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Reunião">Reunião</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-2 italic">
                        <input type="text" id="work-task-requester" placeholder="SOLICITANTE..." class="w-full p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-xs font-bold text-slate-300 outline-none uppercase italic">
                        <input type="date" id="work-task-deadline" class="w-full p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-xs font-bold text-slate-400 outline-none italic">
                    </div>
                    <button onclick="window.addWorkTask()" class="w-full bg-sky-600 hover:bg-sky-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest mt-2 transition-all shadow-lg active:scale-[0.98] italic">
                        Lançar Atividade
                    </button>
                </div>

                <!-- Lista de Atividades -->
                <div class="space-y-4 italic">
                    <div class="flex items-center justify-between px-6 italic">
                        <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Tarefas Ativas</h3>
                        <div class="flex items-center gap-2">
                            <span id="task-count" class="text-[10px] font-black text-sky-400 tracking-widest italic">0</span>
                            <span class="text-[8px] font-bold text-slate-700 uppercase italic">Pendentes</span>
                        </div>
                    </div>
                    <div id="work-task-active-list" class="space-y-2 italic">
                        <!-- Gerado dinamicamente pelo app.js -->
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <script src="js/app.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            if (window.lucide) lucide.createIcons();
        });
    </script>
</body>
</html>
