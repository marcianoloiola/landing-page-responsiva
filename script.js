/**
 * SISTEMA DE RECEPÇÃO - FRONTEND JAVASCRIPT
 * Versão: 2.2 - TELA DE LOGIN TRADICIONAL
 */

// ========================================
// CONFIGURAÇÕES GLOBAIS
// ========================================

const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbzy5juWPDAtuMXygTt0UMBk9KMOqfqiE0pRJ63cf7TBeCfRPQnjcoJU_AWj5xn-Hqm9/exec', // SUBSTITUIR PELO SEU ID
    AUDIO_API_URL: 'https://whats-n8n.lz1kff.easypanel.host/webhook/b610db54-8ca9-4999-bca9-f5a3ab2d9e85',
    SESSION_KEY: 'igreja_session',
    EVENT_KEY: 'igreja_evento_ativo'
};

let currentUser = null;
let currentEvent = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Sistema de Recepção iniciado - Versão 2.2');
    
    setupEventListeners();
    checkExistingSession();
    setupAudioControls();
    setupFormValidations();
});

// ========================================
// EVENT LISTENERS
// ========================================

function setupEventListeners() {
    // Login
    safeAddEvent('loginForm', 'submit', handleLogin);
    safeAddEvent('logoutBtn', 'click', handleLogout);
    
    // Modais de senha
    safeAddEvent('esqueciSenhaBtn', 'click', () => showModal('esqueciSenhaModal'));
    safeAddEvent('alterarSenhaLoginBtn', 'click', () => showAlterarSenhaModal(true));
    safeAddEvent('alterarSenhaBtn', 'click', () => showAlterarSenhaModal(false));
    safeAddEvent('recuperarSenhaForm', 'submit', handleRecuperarSenha);
    safeAddEvent('alterarSenhaForm', 'submit', handleAlterarSenha);
    
    // Evento
    safeAddEvent('iniciarEventoBtn', 'click', handleIniciarEvento);
    safeAddEvent('trocarEventoBtn', 'click', () => {
        currentEvent = null;
        localStorage.removeItem(CONFIG.EVENT_KEY);
        showSection('eventoSelectionSection');
        loadEventos();
    });
    
    // Menu
    safeAddEvent('showCadastroEventoBtn', 'click', () => showSection('cadastroEventoSection'));
    safeAddEvent('showCadastroConjuntoBtn', 'click', () => showSection('cadastroConjuntoSection'));
    safeAddEvent('showCadastroPessoaBtn', 'click', () => showSection('cadastroPessoaSection'));
    safeAddEvent('showCriarUsuarioBtn', 'click', () => showSection('criarUsuarioSection'));
    safeAddEvent('showManutencaoBtn', 'click', () => showSection('manutencaoSection'));
    
    // Formulários
    safeAddEvent('cadastroEventoForm', 'submit', handleCadastroEvento);
    safeAddEvent('cadastroConjuntoForm', 'submit', handleCadastroConjunto);
    safeAddEvent('cadastroPessoaForm', 'submit', handleCadastroPessoa);
    safeAddEvent('criarUsuarioForm', 'submit', handleCriarUsuario);
    
    // Voltar
    safeAddEvent('voltarMenuFromEventoBtn', 'click', () => voltarParaMenu());
    safeAddEvent('voltarMenuFromConjuntoBtn', 'click', () => voltarParaMenu());
    safeAddEvent('voltarMenuFromPessoaBtn', 'click', () => voltarParaMenu());
    safeAddEvent('voltarMenuFromUsuarioBtn', 'click', () => voltarParaMenu());
    safeAddEvent('voltarMenuFromManutencaoBtn', 'click', () => voltarParaMenu());
    
    // Manutenção
    safeAddEvent('backupBtn', 'click', handleBackup);
    safeAddEvent('resetSenhaBtn', 'click', handleResetSenha);
    safeAddEvent('manutencaoSistemaBtn', 'click', handleManutencaoSistema);
    safeAddEvent('limparDadosBtn', 'click', handleLimparDados);
    
    // Campos condicionais
    safeAddEvent('pessoaEvangelico', 'change', toggleMembroIgreja);
    safeAddEvent('pessoaFuncaoPolitica', 'change', toggleFuncaoPolitica);
    safeAddEvent('pessoaFuncaoEclesiastica', 'change', toggleFuncaoEclesiastica);
}

function safeAddEvent(elementId, event, handler) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(event, handler);
    }
}

// ========================================
// SESSÃO E AUTENTICAÇÃO
// ========================================

function checkExistingSession() {
    const sessionData = localStorage.getItem(CONFIG.SESSION_KEY);
    if (sessionData) {
        try {
            const session = JSON.parse(sessionData);
            currentUser = session.user;
            updateUserInterface();
            
            const savedEvent = localStorage.getItem(CONFIG.EVENT_KEY);
            if (savedEvent) {
                currentEvent = JSON.parse(savedEvent);
                setElementText('eventoAtivo', currentEvent.nome);
                loadEventos().then(() => showSection('mainMenuSection'));
            } else {
                loadEventos().then(() => {
                    // Se for admin, pode ir direto pro menu, senão precisa escolher evento
                    if (currentUser.nivel === 'admin') {
                        showSection('mainMenuSection');
                    } else {
                        setElementText('userNameEvento', currentUser.usuario);
                        showSection('eventoSelectionSection');
                    }
                });
            }
        } catch (error) {
            console.error('Erro na sessão:', error);
            clearSession();
            showSection('loginSection');
        }
    } else {
        showSection('loginSection');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const usuario = getValue('loginUsuario');
    const senha = getValue('loginSenha');
    
    if (!usuario || !senha) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('login', { usuario, senha });
        
        if (response.success) {
            currentUser = response.user;
            
            localStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify({
                user: response.user,
                token: response.token,
                timestamp: Date.now()
            }));
            
            updateUserInterface();
            await loadEventos();
            
            // Determina próxima tela baseada no nível do usuário
            if (currentUser.nivel === 'admin') {
                showSection('mainMenuSection');
                showToast(`Bem-vindo, Administrador ${response.user.usuario}!`, 'success');
            } else {
                setElementText('userNameEvento', currentUser.usuario);
                showSection('eventoSelectionSection');
                showToast(`Bem-vindo, ${response.user.usuario}! Selecione o evento para continuar.`, 'success');
            }
            
            clearForm('loginForm');
        } else {
            showToast(response.message || 'Usuário ou senha incorretos', 'danger');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro de conexão. Verifique sua internet.', 'danger');
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    if (confirm('Deseja sair do sistema?')) {
        currentUser = null;
        currentEvent = null;
        clearSession();
        showSection('loginSection');
        showToast('Logout realizado com sucesso', 'info');
    }
}

function clearSession() {
    localStorage.removeItem(CONFIG.SESSION_KEY);
    localStorage.removeItem(CONFIG.EVENT_KEY);
    hideElement('userInfo');
}

function updateUserInterface() {
    if (currentUser) {
        setElementText('userName', currentUser.usuario);
        showElement('userInfo', true);
        
        const isAdmin = currentUser.nivel === 'admin';
        showElement('cadastroEventoCard', isAdmin);
        showElement('criarUsuarioCard', isAdmin);
        showElement('manutencaoCard', isAdmin);
    }
}

function voltarParaMenu() {
    // Se usuário comum e não tem evento selecionado, volta para seleção
    if (currentUser && currentUser.nivel !== 'admin' && !currentEvent) {
        setElementText('userNameEvento', currentUser.usuario);
        showSection('eventoSelectionSection');
    } else {
        showSection('mainMenuSection');
    }
}

// ========================================
// RECUPERAÇÃO DE SENHA
// ========================================

async function handleRecuperarSenha(e) {
    e.preventDefault();
    
    const email = getValue('emailRecuperacao');
    if (!email) {
        showToast('Digite seu email', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('recuperarSenha', { email });
        if (response.success) {
            showToast('Nova senha enviada por email!', 'success');
            hideModal('esqueciSenhaModal');
            showModal('loginModal');
            clearForm('recuperarSenhaForm');
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

function showAlterarSenhaModal(isLogin) {
    const usuarioGroup = document.getElementById('usuarioAlteracaoGroup');
    if (usuarioGroup) {
        usuarioGroup.style.display = isLogin ? 'block' : 'none';
    }
    
    if (!isLogin && currentUser) {
        setValue('usuarioAlteracao', currentUser.usuario);
    }
    
    showModal('alterarSenhaModal');
}

async function handleAlterarSenha(e) {
    e.preventDefault();
    
    const usuario = getValue('usuarioAlteracao');
    const senhaAtual = getValue('senhaAtual');
    const senhaNova = getValue('senhaNova');
    const senhaConfirma = getValue('senhaConfirma');
    
    if (!usuario || !senhaAtual || !senhaNova) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }
    
    if (senhaNova !== senhaConfirma) {
        showToast('Senhas não coincidem', 'warning');
        return;
    }
    
    if (senhaNova.length < 4) {
        showToast('Nova senha deve ter pelo menos 4 caracteres', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('alterarSenha', { usuario, senhaAtual, novaSenha: senhaNova });
        if (response.success) {
            showToast('Senha alterada com sucesso!', 'success');
            hideModal('alterarSenhaModal');
            clearForm('alterarSenhaForm');
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// ========================================
// EVENTOS
// ========================================

async function loadEventos() {
    try {
        const response = await apiCall('listarEventos');
        if (response.success) {
            const select = document.getElementById('eventoSelect');
            if (select) {
                select.innerHTML = '<option value="">Selecione um evento...</option>';
                response.data.forEach(evento => {
                    const option = document.createElement('option');
                    option.value = evento.id;
                    option.textContent = `${formatDate(evento.data)} - ${evento.departamento}`;
                    option.dataset.nome = `${formatDate(evento.data)} - ${evento.departamento}`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Erro ao carregar eventos:', error);
        showToast('Erro ao carregar eventos', 'warning');
    }
}

function handleIniciarEvento() {
    const eventoSelect = document.getElementById('eventoSelect');
    const eventoId = eventoSelect.value;
    const eventoNome = eventoSelect.selectedOptions[0]?.dataset.nome;
    
    if (!eventoId) {
        showToast('Selecione um evento', 'warning');
        return;
    }
    
    currentEvent = { id: eventoId, nome: eventoNome };
    localStorage.setItem(CONFIG.EVENT_KEY, JSON.stringify(currentEvent));
    
    setElementText('eventoAtivo', eventoNome);
    showSection('mainMenuSection');
    showToast('Evento iniciado! Agora você pode usar todas as funções.', 'success');
}

async function handleCadastroEvento(e) {
    e.preventDefault();
    
    const data = getValue('eventoData');
    const departamento = getValue('eventoDepartamento');
    
    if (!data || !departamento) {
        showToast('Preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('criarEvento', {
            data,
            departamento,
            usuarioLogado: currentUser.usuario
        });
        
        if (response.success) {
            showToast('Evento cadastrado com sucesso!', 'success');
            clearForm('cadastroEventoForm');
            await loadEventos();
            showSection('mainMenuSection');
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// ========================================
// CONJUNTOS
// ========================================

async function handleCadastroConjunto(e) {
    e.preventDefault();
    
    if (!currentEvent) {
        showToast('Selecione um evento primeiro', 'warning');
        voltarParaMenu();
        return;
    }
    
    const nome = getValue('conjuntoNome');
    const lideranca = getValue('conjuntoLideranca');
    const contatoLider = getValue('conjuntoContatoLider');
    const obreiros = getValue('conjuntoObreiros');
    const igreja = getValue('conjuntoIgreja');
    
    if (!nome || !lideranca || !obreiros || !igreja) {
        showToast('Preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    if (contatoLider && !validateTelefone(contatoLider)) {
        showToast('Telefone deve ter exatamente 11 dígitos (DDD + 9 + número)', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('criarConjunto', {
            eventoId: currentEvent.id,
            nome,
            lideranca,
            contatoLider,
            obreiros,
            igreja
        });
        
        if (response.success) {
            showToast('Conjunto cadastrado com sucesso!', 'success');
            clearForm('cadastroConjuntoForm');
            voltarParaMenu();
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// ========================================
// PESSOAS
// ========================================

async function handleCadastroPessoa(e) {
    e.preventDefault();
    
    if (!currentEvent) {
        showToast('Selecione um evento primeiro', 'warning');
        voltarParaMenu();
        return;
    }
    
    const nome = getValue('pessoaNome');
    const evangelico = getValue('pessoaEvangelico');
    const membroIgreja = getValue('pessoaMembroIgreja');
    const funcaoPolitica = getValue('pessoaFuncaoPolitica');
    const funcaoPoliticaDesc = getValue('pessoaFuncaoPoliticaDesc');
    const funcaoEclesiastica = getValue('pessoaFuncaoEclesiastica');
    const funcaoEclesiasticaDesc = getValue('pessoaFuncaoEclesiasticaDesc');
    const contato = getValue('pessoaContato');
    
    if (!nome || !evangelico || !funcaoPolitica || !funcaoEclesiastica) {
        showToast('Preencha todos os campos obrigatórios', 'warning');
        return;
    }
    
    if (evangelico === 'Sim' && !membroIgreja) {
        showToast('Informe a igreja do membro', 'warning');
        return;
    }
    
    if (funcaoPolitica === 'Sim' && !funcaoPoliticaDesc) {
        showToast('Descreva a função política', 'warning');
        return;
    }
    
    if (funcaoEclesiastica === 'Sim' && !funcaoEclesiasticaDesc) {
        showToast('Descreva a função eclesiástica', 'warning');
        return;
    }
    
    if (contato && !validateTelefone(contato)) {
        showToast('Telefone deve ter exatamente 11 dígitos', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('criarPessoa', {
            eventoId: currentEvent.id,
            nome,
            evangelico,
            membroIgreja,
            funcaoPolitica,
            funcaoPoliticaDesc,
            funcaoEclesiastica,
            funcaoEclesiasticaDesc,
            contato
        });
        
        if (response.success) {
            showToast('Pessoa cadastrada com sucesso!', 'success');
            clearForm('cadastroPessoaForm');
            resetCamposCondicionais();
            voltarParaMenu();
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// Campos condicionais
function toggleMembroIgreja() {
    const evangelico = getValue('pessoaEvangelico');
    const group = document.getElementById('membroIgrejaGroup');
    const input = document.getElementById('pessoaMembroIgreja');
    
    if (group && input) {
        if (evangelico === 'Sim') {
            group.style.display = 'block';
            input.required = true;
        } else {
            group.style.display = 'none';
            input.required = false;
            input.value = '';
        }
    }
}

function toggleFuncaoPolitica() {
    const funcao = getValue('pessoaFuncaoPolitica');
    const group = document.getElementById('funcaoPoliticaDescGroup');
    const input = document.getElementById('pessoaFuncaoPoliticaDesc');
    
    if (group && input) {
        if (funcao === 'Sim') {
            group.style.display = 'block';
            input.required = true;
        } else {
            group.style.display = 'none';
            input.required = false;
            input.value = '';
        }
    }
}

function toggleFuncaoEclesiastica() {
    const funcao = getValue('pessoaFuncaoEclesiastica');
    const group = document.getElementById('funcaoEclesiasticaDescGroup');
    const input = document.getElementById('pessoaFuncaoEclesiasticaDesc');
    
    if (group && input) {
        if (funcao === 'Sim') {
            group.style.display = 'block';
            input.required = true;
        } else {
            group.style.display = 'none';
            input.required = false;
            input.value = '';
        }
    }
}

function resetCamposCondicionais() {
    toggleMembroIgreja();
    toggleFuncaoPolitica();
    toggleFuncaoEclesiastica();
}

// ========================================
// USUÁRIOS (ADMIN APENAS)
// ========================================

async function handleCriarUsuario(e) {
    e.preventDefault();
    
    if (currentUser.nivel !== 'admin') {
        showToast('Apenas administradores podem criar usuários', 'danger');
        return;
    }
    
    const usuario = getValue('novoUsuario');
    const email = getValue('novoEmail');
    const senha = getValue('novaSenha');
    const nivel = getValue('novoNivel');
    
    if (!usuario || !email || !senha || !nivel) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }
    
    if (!validateEmail(email)) {
        showToast('Email inválido', 'warning');
        return;
    }
    
    if (senha.length < 4) {
        showToast('Senha deve ter pelo menos 4 caracteres', 'warning');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiCall('criarUsuario', {
            usuario,
            email,
            senha,
            nivel,
            usuarioLogado: currentUser.usuario
        });
        
        if (response.success) {
            showToast('Usuário criado com sucesso!', 'success');
            clearForm('criarUsuarioForm');
            voltarParaMenu();
        } else {
            showToast(response.message, 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// ========================================
// MANUTENÇÃO (ADMIN APENAS)
// ========================================

async function handleBackup() {
    if (currentUser.nivel !== 'admin') {
        showToast('Apenas administradores podem fazer backup', 'danger');
        return;
    }
    
    if (!confirm('Deseja criar um backup dos dados?')) return;
    
    showLoading(true);
    try {
        const response = await apiCall('backup');
        if (response.success) {
            showToast('Backup criado com sucesso!', 'success');
        } else {
            showToast(response.message || 'Erro no backup', 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

async function handleResetSenha() {
    if (currentUser.nivel !== 'admin') {
        showToast('Apenas administradores podem resetar senhas', 'danger');
        return;
    }
    
    if (!confirm('Resetar senha do admin para "admin123"?')) return;
    
    showLoading(true);
    try {
        const response = await apiCall('resetarSenhaAdmin');
        if (response.success) {
            showToast('Senha do admin resetada para "admin123"', 'success');
        } else {
            showToast(response.message || 'Erro no reset', 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

async function handleManutencaoSistema() {
    if (currentUser.nivel !== 'admin') {
        showToast('Apenas administradores podem executar manutenção', 'danger');
        return;
    }
    
    if (!confirm('Executar manutenção do sistema? (Criará dados de teste)')) return;
    
    showLoading(true);
    try {
        const response = await apiCall('manutencao');
        if (response.success) {
            showToast('Manutenção concluída com sucesso!', 'success');
            await loadEventos();
        } else {
            showToast(response.message || 'Erro na manutenção', 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

async function handleLimparDados() {
    if (currentUser.nivel !== 'admin') {
        showToast('Apenas administradores podem limpar dados', 'danger');
        return;
    }
    
    const confirmacao = prompt('⚠️ ATENÇÃO! Esta ação irá DELETAR TODOS OS DADOS.\n\nDigite "CONFIRMAR" para prosseguir:');
    if (confirmacao !== 'CONFIRMAR') {
        showToast('Operação cancelada', 'info');
        return;
    }
    
    showLoading(true);
    try {
        const response = await apiCall('limparDados');
        if (response.success) {
            showToast('Todos os dados foram limpos! Fazendo logout...', 'success');
            setTimeout(() => {
                handleLogout();
            }, 3000);
        } else {
            showToast(response.message || 'Erro ao limpar dados', 'danger');
        }
    } catch (error) {
        showToast('Erro de conexão', 'danger');
    } finally {
        showLoading(false);
    }
}

// ========================================
// ÁUDIO E TRANSCRIÇÃO
// ========================================

function setupAudioControls() {
    document.querySelectorAll('.record-audio').forEach(button => {
        button.addEventListener('click', () => startRecording(button));
    });
    
    document.querySelectorAll('.stop-recording').forEach(button => {
        button.addEventListener('click', () => stopRecording(button));
    });
}

async function startRecording(button) {
    if (isRecording) {
        showToast('Já está gravando áudio', 'warning');
        return;
    }
    
    const targetId = button.dataset.target;
    const targetField = document.getElementById(targetId);
    
    if (!targetField) {
        showToast('Campo não encontrado', 'danger');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];
        isRecording = true;
        
        // UI Updates
        button.classList.add('d-none');
        const stopBtn = button.parentElement.querySelector('.stop-recording');
        if (stopBtn) stopBtn.classList.remove('d-none');
        
        targetField.classList.add('is-recording');
        const originalValue = targetField.value;
        targetField.value = '🎤 Gravando... (clique no botão vermelho para parar)';
        
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                await processAudio(audioBlob, targetField, originalValue);
            } catch (error) {
                console.error('Erro no processamento do áudio:', error);
                targetField.value = originalValue;
                showToast('Erro no processamento do áudio', 'danger');
            }
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            button.classList.remove('d-none');
            if (stopBtn) stopBtn.classList.add('d-none');
            targetField.classList.remove('is-recording');
        };
        
        mediaRecorder.start(1000); // Collect data every second
        showToast('Gravação iniciada! Fale agora...', 'info');
        
    } catch (error) {
        console.error('Erro ao acessar microfone:', error);
        showToast('Erro ao acessar microfone. Verifique as permissões.', 'danger');
        
        // Reset UI
        isRecording = false;
        button.classList.remove('d-none');
        const stopBtn = button.parentElement.querySelector('.stop-recording');
        if (stopBtn) stopBtn.classList.add('d-none');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        showToast('Gravação finalizada. Processando...', 'info');
    }
}

async function processAudio(audioBlob, targetField, originalValue) {
    try {
        targetField.value = '⏳ Transcrevendo áudio...';
        
        // Convert to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
            try {
                const base64Audio = reader.result.split(',')[1];
                
                const response = await fetch(CONFIG.AUDIO_API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        audio: base64Audio,
                        format: 'webm'
                    }),
                    timeout: 15000 // 15 second timeout
                });
                
                if (response.ok) {
                    const result = await response.json();
                    let transcribedText = '';
                    
                    // Parse different response formats
                    if (Array.isArray(result) && result.length > 0) {
                        transcribedText = result[0]?.text || result[0]?.transcript || '';
                    } else if (result?.text) {
                        transcribedText = result.text;
                    } else if (result?.transcript) {
                        transcribedText = result.transcript;
                    } else if (typeof result === 'string') {
                        transcribedText = result;
                    }
                    
                    if (transcribedText && transcribedText.trim()) {
                        // Clean up the transcribed text
                        transcribedText = transcribedText.trim()
                            .replace(/\s+/g, ' ') // Remove extra spaces
                            .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
                        
                        targetField.value = transcribedText;
                        showToast('Áudio transcrito com sucesso!', 'success');
                    } else {
                        targetField.value = originalValue;
                        showToast('Não foi possível transcrever o áudio. Tente novamente.', 'warning');
                    }
                } else {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
            } catch (error) {
                console.error('Erro na transcrição:', error);
                targetField.value = originalValue;
                showToast('Erro na transcrição. Verifique sua conexão.', 'danger');
            }
        };
        
        reader.onerror = () => {
            targetField.value = originalValue;
            showToast('Erro ao processar o arquivo de áudio', 'danger');
        };
        
    } catch (error) {
        console.error('Erro no processamento:', error);
        targetField.value = originalValue;
        showToast('Erro no processamento do áudio', 'danger');
    }
}

// ========================================
// VALIDAÇÕES
// ========================================

function setupFormValidations() {
    // Validação de telefone em tempo real
    const telefoneInputs = ['conjuntoContatoLider', 'pessoaContato'];
    telefoneInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', e => {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length > 11) value = value.substring(0, 11);
                e.target.value = value;
                
                // Visual feedback
                if (value.length > 0 && value.length < 11) {
                    e.target.classList.add('is-invalid');
                    e.target.classList.remove('is-valid');
                } else if (value.length === 11) {
                    e.target.classList.add('is-valid');
                    e.target.classList.remove('is-invalid');
                } else {
                    e.target.classList.remove('is-valid', 'is-invalid');
                }
            });
        }
    });
    
    // Validação de email em tempo real
    const emailInputs = ['novoEmail', 'emailRecuperacao'];
    emailInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('blur', e => {
                const email = e.target.value.trim();
                if (email && !validateEmail(email)) {
                    e.target.classList.add('is-invalid');
                    e.target.classList.remove('is-valid');
                } else if (email) {
                    e.target.classList.add('is-valid');
                    e.target.classList.remove('is-invalid');
                } else {
                    e.target.classList.remove('is-valid', 'is-invalid');
                }
            });
        }
    });
}

function validateTelefone(telefone) {
    if (!telefone) return true; // Campo opcional
    return /^\d{11}$/.test(telefone);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ========================================
// UTILITÁRIOS DE INTERFACE
// ========================================

function showSection(sectionId) {
    const sections = [
        'loginSection', 'eventoSelectionSection', 'mainMenuSection',
        'cadastroEventoSection', 'cadastroConjuntoSection', 'cadastroPessoaSection',
        'criarUsuarioSection', 'manutencaoSection'
    ];
    
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
        }
    });
    
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
        // Scroll suave para o topo da seção
        setTimeout(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

function showLoading(show) {
    const modal = document.getElementById('loadingModal');
    if (modal) {
        if (show) {
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
        } else {
            const instance = bootstrap.Modal.getInstance(modal);
            if (instance) instance.hide();
        }
    }
}

function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toastId = 'toast-' + Date.now();
    const bgClass = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info',
        'primary': 'bg-primary'
    }[type] || 'bg-info';
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white ${bgClass}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${getToastIcon(type)} me-2"></i>${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    container.appendChild(toast);
    
    const toastInstance = new bootstrap.Toast(toast, { 
        delay: duration,
        autohide: true 
    });
    toastInstance.show();
    
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

function getToastIcon(type) {
    const icons = {
        'success': 'bi-check-circle',
        'danger': 'bi-exclamation-triangle',
        'warning': 'bi-exclamation-circle',
        'info': 'bi-info-circle',
        'primary': 'bi-bell'
    };
    return icons[type] || 'bi-info-circle';
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        const instance = bootstrap.Modal.getInstance(modal);
        if (instance) {
            instance.hide();
        }
    }
}

function getValue(elementId) {
    const el = document.getElementById(elementId);
    return el ? el.value.trim() : '';
}

function setValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.value = value;
}

function setElementText(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

function showElement(elementId, show = true) {
    const el = document.getElementById(elementId);
    if (el) {
        el.style.display = show ? 'block' : 'none';
    }
}

function hideElement(elementId) {
    showElement(elementId, false);
}

function clearForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        // Remove validation classes
        form.querySelectorAll('.is-valid, .is-invalid').forEach(el => {
            el.classList.remove('is-valid', 'is-invalid');
        });
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch {
        return dateString;
    }
}

// ========================================
// API CALLS
// ========================================

async function apiCall(action, data = {}) {
    if (!CONFIG.API_URL || CONFIG.API_URL.includes('SUA_URL')) {
        throw new Error('Configure a URL da API no arquivo de configuração');
    }
    
    try {
        const requestData = {
            action,
            ...data
        };
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Erro na API:', error);
        throw error;
    }
}

// ========================================
// TRATAMENTO DE ERROS GLOBAIS
// ========================================

window.addEventListener('error', function(e) {
    console.error('Erro JavaScript:', e.error);
    showToast('Ocorreu um erro inesperado. Recarregue a página se necessário.', 'danger');
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Promise rejeitada:', e.reason);
    showToast('Erro de conexão. Verifique sua internet.', 'warning');
});

// ========================================
// DEBUG E DESENVOLVIMENTO
// ========================================

console.log('✅ Sistema de Recepção carregado - Versão 2.1 Corrigida');

// Expor funções para debug apenas em localhost
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    window.SistemaDebug = {
        currentUser: () => currentUser,
        currentEvent: () => currentEvent,
        showToast: (msg, type) => showToast(msg, type),
        apiCall: (action, data) => apiCall(action, data),
        config: CONFIG,
        clearSession: () => clearSession(),
        forceLogin: (user) => {
            currentUser = user;
            updateUserInterface();
            showSection('mainMenuSection');
        }
    };
    
    console.log('🔧 Modo debug ativado. Use: window.SistemaDebug');
    console.log('📝 Exemplos:');
    console.log('  - SistemaDebug.showToast("Teste", "success")');
    console.log('  - SistemaDebug.currentUser()');
    console.log('  - SistemaDebug.clearSession()');
}

// ========================================
// INICIALIZAÇÃO FINAL
// ========================================

// Verificar se o navegador suporta as funcionalidades necessárias
if (!window.fetch) {
    alert('Seu navegador não é compatível. Use uma versão mais recente.');
}

if (!navigator.mediaDevices) {
    console.warn('Funcionalidade de áudio não disponível neste navegador.');
}

// Configurar data mínima para campos de data
document.addEventListener('DOMContentLoaded', function() {
    const dateInputs = document.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = today;
        }
    });
});

// Prevenir submissão de formulários vazios
document.addEventListener('submit', function(e) {
    const form = e.target;
    const requiredFields = form.querySelectorAll('[required]');
    let hasErrors = false;
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('is-invalid');
            hasErrors = true;
        } else {
            field.classList.remove('is-invalid');
        }
    });
    
    if (hasErrors) {
        e.preventDefault();
        showToast('Preencha todos os campos obrigatórios', 'warning');
    }
});

// Auto-save do evento selecionado
document.addEventListener('change', function(e) {
    if (e.target.id === 'eventoSelect' && e.target.value) {
        const option = e.target.selectedOptions[0];
        const eventoData = {
            id: e.target.value,
            nome: option.dataset.nome || option.textContent
        };
        localStorage.setItem(CONFIG.EVENT_KEY + '_temp', JSON.stringify(eventoData));
    }
});

console.log('🎉 Sistema totalmente carregado e pronto para uso!');

// Função corrigida para iniciar gravação
async function startRecording(button) {
    if (isRecording) {
        showToast('Já está gravando áudio', 'warning');
        return;
    }
    
    const targetId = button.dataset.target;
    const targetField = document.getElementById(targetId);
    const audioControls = button.closest('.audio-controls');
    
    if (!targetField || !audioControls) {
        showToast('Erro no sistema de áudio', 'danger');
        return;
    }
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];
        isRecording = true;
        
        // CORRIGIR: Adicionar classe no container pai
        audioControls.classList.add('recording-active');
        
        // Atualizar campo de texto
        targetField.classList.add('is-recording');
        const originalValue = targetField.value;
        targetField.value = '🎤 Gravando... (clique no botão vermelho para parar)';
        
        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            try {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                await processAudio(audioBlob, targetField, originalValue);
            } catch (error) {
                console.error('Erro no processamento:', error);
                targetField.value = originalValue;
                showToast('Erro no processamento do áudio', 'danger');
            }
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            isRecording = false;
            audioControls.classList.remove('recording-active');
            targetField.classList.remove('is-recording');
        };
        
        mediaRecorder.start(1000);
        showToast('Gravação iniciada! Fale agora...', 'info');
        
    } catch (error) {
        console.error('Erro ao acessar microfone:', error);
        showToast('Erro ao acessar microfone. Verifique as permissões.', 'danger');
        
        // Reset
        isRecording = false;
        audioControls.classList.remove('recording-active');
    }
}

// Função corrigida para parar gravação
function stopRecording(button) {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        showToast('Gravação finalizada. Processando...', 'info');
    }
}
