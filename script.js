let estoque = [];
let logs = [];
const API_URL = '';

const modalOverlay = document.getElementById('modal-overlay');
const modalContentHost = document.getElementById('modal-content-host');

// --- NOTIFICAÇÕES TOAST ---
function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

// --- LÓGICA DO MODAL ---
async function openModal(templateId, isLarge = false, context = null) {
    const template = document.getElementById(templateId);
    if (!template) return;
    
    modalContentHost.innerHTML = '';
    modalContentHost.className = 'modal-content';
    if (isLarge) modalContentHost.classList.add('modal-lg');

    const content = template.content.cloneNode(true);
    modalContentHost.appendChild(content);
    
    if (templateId === 'template-estoque') await setupEstoqueView();
    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-relatorio') await setupRelatorioView();
    if (templateId === 'template-editar') setupFormEditar(context);
    if (templateId === 'template-retirar') setupFormRetirar(context);
    if (templateId === 'template-historico-item') await renderizarHistoricoItem(context);
    
    modalOverlay.classList.add('active');
}
function closeModal() {
    modalOverlay.classList.remove('active');
}
modalOverlay.addEventListener('mousedown', (event) => { if (event.target === modalOverlay) closeModal(); });

// --- API HELPERS ---
async function fetchData() {
    try {
        const [estoqueRes, logRes] = await Promise.all([ fetch(`${API_URL}/api/estoque`), fetch(`${API_URL}/api/log`) ]);
        estoque = await estoqueRes.json();
        logs = await logRes.json();
    } catch (error) { showToast('Falha ao carregar dados do servidor.', 'error'); }
}
async function saveEstoque(estoqueParaSalvar) {
    const response = await fetch(`${API_URL}/api/estoque`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(estoqueParaSalvar) });
    if (!response.ok) { const error = await response.json(); showToast(`Erro do servidor: ${error.message}`, 'error'); return false; }
    return true;
}
async function saveLog(logEntry) { await fetch(`${API_URL}/api/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) }); }

// --- LÓGICA DOS FORMULÁRIOS ---
function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item'); document.getElementById('data').valueAsDate = new Date(); const radioSim = document.getElementById('patrimonio-sim'); const radioNao = document.getElementById('patrimonio-nao'); const containerPatrimonio = document.getElementById('patrimonio-input-container'); const inputPatrimonio = document.getElementById('patrimonio-numero'); const inputQuantidade = document.getElementById('quantidade');
    function togglePatrimonio() { if (radioSim.checked) { containerPatrimonio.style.display = 'block'; inputPatrimonio.required = true; inputQuantidade.value = 1; inputQuantidade.disabled = true; } else { containerPatrimonio.style.display = 'none'; inputPatrimonio.required = false; inputPatrimonio.value = ''; inputQuantidade.disabled = false; } }
    radioSim.addEventListener('change', togglePatrimonio); radioNao.addEventListener('change', togglePatrimonio);
    async function handleSave() {
        if (!form.checkValidity()) { form.reportValidity(); return false; }
        await fetchData(); const temPatrimonio = radioSim.checked; const patrimonio = temPatrimonio ? inputPatrimonio.value.trim() : 'N/A'; const quantidadeAdicionada = parseInt(inputQuantidade.value); const categoria = form.querySelector('#categoria').value; const identificacao = form.querySelector('#identificacao').value.trim(); const dataTransacao = form.querySelector('#data').value; const observacaoTransacao = form.querySelector('#observacao').value || 'Nenhuma';
        if (temPatrimonio && !patrimonio) { showToast('Número do patrimônio é obrigatório.', 'error'); return false; }
        let estoqueTemporario = [...estoque];
        if (temPatrimonio) { const patrimonioExistente = estoqueTemporario.some(item => item.patrimonio.toLowerCase() === patrimonio.toLowerCase() && item.patrimonio !== 'N/A'); if (patrimonioExistente) { showToast('Este número de patrimônio já existe.', 'error'); return false; } const novoItemUnico = { id: Date.now(), categoria, identificacao, quantidade: 1, patrimonio }; estoqueTemporario.push(novoItemUnico); } else { const itemGenericoExistente = estoqueTemporario.find(item => item.identificacao.toLowerCase() === identificacao.toLowerCase() && item.categoria === categoria && item.patrimonio === 'N/A'); if (itemGenericoExistente) { itemGenericoExistente.quantidade += quantidadeAdicionada; } else { const novoItemGenerico = { id: Date.now(), categoria, identificacao, quantidade: quantidadeAdicionada, patrimonio: 'N/A' }; estoqueTemporario.push(novoItemGenerico); } }
        const success = await saveEstoque(estoqueTemporario);
        if (success) { const logEntry = { timestamp: new Date().toISOString(), type: 'adicao', itemName: identificacao, categoria: categoria, quantity: quantidadeAdicionada, observacao: observacaoTransacao, data: dataTransacao, patrimonio: patrimonio }; await saveLog(logEntry); showToast('Item salvo com sucesso!'); return true; }
        return false;
    }
    document.getElementById('btn-salvar-fechar').addEventListener('click', async (e) => { e.preventDefault(); const success = await handleSave(); if (success) closeModal(); });
    document.getElementById('btn-salvar-outro').addEventListener('click', async (e) => { e.preventDefault(); const success = await handleSave(); if (success) { form.reset(); document.getElementById('data').valueAsDate = new Date(); togglePatrimonio(); } });
}
function setupFormEditar(itemId) {
    const item = estoque.find(i => i.id === itemId); if (!item) { showToast('Item não encontrado.', 'error'); return; }
    const form = document.getElementById('form-editar-item'); const selectCategoria = document.getElementById('categoria-editar'); const inputIdentificacao = document.getElementById('identificacao-editar'); const inputQuantidade = document.getElementById('quantidade-editar'); const inputPatrimonio = document.getElementById('patrimonio-editar');
    const categoriasTemplate = document.getElementById('template-adicionar').content.querySelector('#categoria'); selectCategoria.innerHTML = categoriasTemplate.innerHTML; selectCategoria.value = item.categoria;
    inputIdentificacao.value = item.identificacao; inputQuantidade.value = item.quantidade; inputPatrimonio.value = item.patrimonio;
    form.onsubmit = async (event) => {
        event.preventDefault(); await fetchData(); const itemOriginalIndex = estoque.findIndex(i => i.id === itemId); if (itemOriginalIndex === -1) { showToast('Item não mais encontrado.', 'error'); return; }
        const itemOriginal = estoque[itemOriginalIndex]; const oldItemName = itemOriginal.identificacao; const oldItemCategory = itemOriginal.categoria;
        const novoNome = inputIdentificacao.value.trim(); const novaCategoria = selectCategoria.value;
        const nameChanged = oldItemName.toLowerCase() !== novoNome.toLowerCase(); const categoryChanged = oldItemCategory !== novaCategoria;
        if (!nameChanged && !categoryChanged) { showToast("Nenhuma alteração foi feita.", "info"); closeModal(); return; }
        let estoqueAtualizado = [...estoque]; let logObservacaoParts = []; if (nameChanged) logObservacaoParts.push(`nome de '${oldItemName}' para '${novoNome}'`); if (categoryChanged) logObservacaoParts.push(`categoria de '${oldItemCategory}' para '${novaCategoria}'`); let logObservacao = `Alterado: ${logObservacaoParts.join('; ')}.`;
        if (itemOriginal.patrimonio === 'N/A') { const alvoDaFusao = estoqueAtualizado.find(item => item.id !== itemId && item.patrimonio === 'N/A' && item.identificacao.toLowerCase() === novoNome.toLowerCase() && item.categoria === novaCategoria); if (alvoDaFusao) { alvoDaFusao.quantidade += itemOriginal.quantidade; estoqueAtualizado = estoqueAtualizado.filter(item => item.id !== itemId); logObservacao = `Item '${oldItemName}' foi unificado com '${novoNome}'. (${logObservacaoParts.join('; ')})`; } else { estoqueAtualizado[itemOriginalIndex].identificacao = novoNome; estoqueAtualizado[itemOriginalIndex].categoria = novaCategoria; } } else { estoqueAtualizado[itemOriginalIndex].identificacao = novoNome; estoqueAtualizado[itemOriginalIndex].categoria = novaCategoria; }
        const success = await saveEstoque(estoqueAtualizado);
        if (success) { const logEntry = { timestamp: new Date().toISOString(), type: 'edicao', itemName: novoNome, categoria: novaCategoria, oldItemName: oldItemName, quantity: 0, observacao: logObservacao, data: new Date().toISOString().split('T')[0] }; await saveLog(logEntry); showToast('Item atualizado com sucesso!'); await openModal('template-estoque', true); }
    };
}
function setupFormRetirar(itemId) {
    const item = estoque.find(i => i.id === itemId); if (!item) return;
    document.getElementById('retirar-item-info').innerHTML = `<strong>${item.identificacao}</strong><br><small>Qtd. Atual: ${item.quantidade} | Patrimônio: ${item.patrimonio}</small>`;
    const form = document.getElementById('form-retirar-item'); const inputQuantidade = document.getElementById('quantidade-retirar');
    if (item.patrimonio !== 'N/A') { inputQuantidade.value = 1; inputQuantidade.disabled = true; } else { inputQuantidade.max = item.quantidade; inputQuantidade.value = 1; }
    form.onsubmit = async (event) => {
        event.preventDefault(); await fetchData(); const itemIndex = estoque.findIndex(i => i.id === itemId); if (itemIndex === -1) { showToast('Item não mais encontrado.', 'error'); return; }
        const quantidade = parseInt(inputQuantidade.value); const observacao = document.getElementById('observacao-retirar').value || 'Nenhuma';
        if (isNaN(quantidade) || quantidade <= 0 || quantidade > estoque[itemIndex].quantidade) { showToast('Quantidade inválida.', 'error'); return; }
        const logEntry = { timestamp: new Date().toISOString(), type: 'retirada', itemId: item.id, itemName: item.identificacao, categoria: item.categoria, quantity: quantidade, observacao, patrimonio: item.patrimonio, data: new Date().toISOString().split('T')[0] };
        estoque[itemIndex].quantidade -= quantidade;
        if (estoque[itemIndex].quantidade === 0) { estoque.splice(itemIndex, 1); }
        const success = await saveEstoque(estoque);
        if (success) { await saveLog(logEntry); showToast('Item retirado com sucesso!'); await openModal('template-estoque', true); }
    };
}

// --- LÓGICA DE VISUALIZAÇÃO E FILTROS ---
async function setupEstoqueView() {
    await fetchData(); setupFiltrosEstoque(); renderizarEstoque();
    const corpoTabela = document.getElementById('corpo-tabela-estoque');
    if (corpoTabela) { corpoTabela.addEventListener('click', (event) => { const target = event.target.closest('button, .item-name'); if (!target) return; const itemId = parseInt(target.dataset.itemId); if (target.classList.contains('action-icon')) { if (target.classList.contains('edit')) openModal('template-editar', false, itemId); if (target.classList.contains('retirar')) openModal('template-retirar', false, itemId); } else if (target.classList.contains('item-name')) { openModal('template-historico-item', true, itemId); } }); }
}
function setupFiltrosEstoque() { const filtroTexto = document.getElementById('filtro-texto'); const filtroCategoria = document.getElementById('filtro-categoria'); const categoriasUnicas = ["Todas as Categorias", ...new Set(estoque.map(item => item.categoria))]; filtroCategoria.innerHTML = categoriasUnicas.map(cat => `<option value="${cat}">${cat}</option>`).join(''); filtroTexto.addEventListener('keyup', renderizarEstoque); filtroCategoria.addEventListener('change', renderizarEstoque); }
function renderizarEstoque() {
    const filtroTextoInput = document.getElementById('filtro-texto'); const filtroCategoriaInput = document.getElementById('filtro-categoria'); if(!filtroTextoInput || !filtroCategoriaInput) return; const filtroTexto = filtroTextoInput.value.toLowerCase(); const filtroCategoria = filtroCategoriaInput.value; let estoqueFiltrado = [...estoque]; if (filtroCategoria && filtroCategoria !== "Todas as Categorias") { estoqueFiltrado = estoqueFiltrado.filter(item => item.categoria === filtroCategoria); } if (filtroTexto) { estoqueFiltrado = estoqueFiltrado.filter(item => item.identificacao.toLowerCase().includes(filtroTexto) || item.patrimonio.toLowerCase().includes(filtroTexto)); }
    const corpoTabela = document.getElementById('corpo-tabela-estoque'); corpoTabela.innerHTML = '';
    estoqueFiltrado.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td data-label="Categoria">${item.categoria}</td><td data-label="Identificação"><span class="item-name" data-item-id="${item.id}">${item.identificacao}</span></td><td data-label="Qtd.">${item.quantidade}</td><td data-label="Patrimônio">${item.patrimonio}</td><td data-label="Ações"><div class="item-actions"><button class="action-icon edit" data-item-id="${item.id}" title="Editar Item"><i class="fa-solid fa-pencil"></i></button><button class="action-icon retirar" data-item-id="${item.id}" title="Retirar Item"><i class="fa-solid fa-arrow-down"></i></button></div></td>`; corpoTabela.appendChild(tr); });
}
async function renderizarHistoricoItem(itemId) {
    const item = estoque.find(i => i.id === itemId); if (!item) return;
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    document.getElementById('historico-item-titulo').textContent = `Histórico: ${item.identificacao}`;
    const corpoTabelaLog = document.getElementById('corpo-tabela-log-item'); corpoTabelaLog.innerHTML = '';
    const historicoDoItem = logs.filter(log => log.itemName.toLowerCase() === item.identificacao.toLowerCase() && log.categoria === item.categoria);
    historicoDoItem.slice().reverse().forEach(log => { const tr = document.createElement('tr'); const tipoClasse = log.type === 'adicao' ? 'adicao' : 'retirada'; tr.innerHTML = `<td data-label="Data">${new Date(log.timestamp).toLocaleString('pt-BR', dateOptions)}</td><td data-label="Tipo" class="${tipoClasse}"><span>${log.type.toUpperCase()}</span></td><td data-label="Categoria">${log.categoria || ''}</td><td data-label="Qtd.">${log.quantity}</td><td data-label="Observação">${log.observacao || ''}</td>`; corpoTabelaLog.appendChild(tr); });
}

// --- LÓGICA DE RELATÓRIOS E BACKUP ---
async function setupRelatorioView() { await fetchData(); renderizarRelatorio(); document.getElementById('import-file').addEventListener('change', importarBackup); document.getElementById('filtro-log-tipo').addEventListener('change', renderizarRelatorio); document.getElementById('filtro-log-item').addEventListener('keyup', renderizarRelatorio); }
function renderizarRelatorio() {
    const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const totalItems = estoque.reduce((sum, item) => sum + item.quantidade, 0); document.getElementById('total-items-summary').textContent = totalItems; document.getElementById('total-moves-summary').textContent = logs.length;
    const filtroTipo = document.getElementById('filtro-log-tipo').value; const filtroItem = document.getElementById('filtro-log-item').value.toLowerCase(); let logsFiltrados = [...logs];
    if (filtroTipo !== 'Todos') { logsFiltrados = logsFiltrados.filter(log => log.type === filtroTipo); }
    if (filtroItem) { logsFiltrados = logsFiltrados.filter(log => log.itemName.toLowerCase().includes(filtroItem)); }
    const corpoTabelaLog = document.getElementById('corpo-tabela-log'); corpoTabelaLog.innerHTML = '';
    logsFiltrados.slice().reverse().forEach(log => {
        const tr = document.createElement('tr'); const tipoClasse = log.type === 'adicao' ? 'adicao' : log.type === 'retirada' ? 'retirada' : '';
        tr.innerHTML = `<td data-label="Data">${new Date(log.timestamp).toLocaleString('pt-BR', dateOptions)}</td><td data-label="Tipo" class="${tipoClasse}"><span>${log.type.toUpperCase()}</span></td><td data-label="Categoria">${log.categoria || ''}</td><td data-label="Item">${log.itemName}</td><td data-label="Qtd.">${log.quantity}</td><td data-label="Observação">${log.observacao || ''}</td>`;
        corpoTabelaLog.appendChild(tr);
    });
}
async function exportarXLSX() {
    await fetchData(); const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const totalItems = estoque.reduce((sum, item) => sum + item.quantidade, 0); const resumoData = [{ "Métrica": "Total de Itens em Estoque", "Valor": totalItems }, { "Métrica": "Total de Movimentos Registrados", "Valor": logs.length }];
    const estoqueData = estoque.map(item => ({ "Categoria": item.categoria, "Identificação": item.identificacao, "Quantidade": item.quantidade, "Patrimônio": item.patrimonio }));
    const logData = logs.map(log => ({ "Data e Hora": new Date(log.timestamp).toLocaleString('pt-BR', dateOptions), "Tipo": log.type === 'adicao' ? 'Adição' : log.type === 'retirada' ? 'Retirada' : 'Edição', "Categoria": log.categoria, "Item": log.itemName, "Quantidade Movida": log.quantity, "Observação": log.observacao, "Data da Transação": log.data ? new Date(log.data + 'T00:00:00').toLocaleDateString('pt-BR') : '', "Patrimônio": log.patrimonio })).reverse();
    const wsResumo = XLSX.utils.json_to_sheet(resumoData); const wsEstoque = XLSX.utils.json_to_sheet(estoqueData); const wsLog = XLSX.utils.json_to_sheet(logData);
    wsEstoque['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(wsEstoque['!ref'])) }; wsLog['!autofilter'] = { ref: XLSX.utils.encode_range(XLSX.utils.decode_range(wsLog['!ref'])) };
    wsEstoque['!cols'] = [{wch:20}, {wch:40}, {wch:10}, {wch:15}]; wsLog['!cols'] = [{wch:20}, {wch:10}, {wch:20}, {wch:40}, {wch:15}, {wch:40}, {wch:15}, {wch:15}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo"); XLSX.utils.book_append_sheet(wb, wsEstoque, "Estoque Atual"); XLSX.utils.book_append_sheet(wb, wsLog, "Histórico de Movimentos");
    const fileName = `Relatorio_Estoque_${new Date().toISOString().split('T')[0]}.xlsx`; XLSX.writeFile(wb, fileName);
}
async function backupDados() { await fetchData(); const backupData = { version: 1, createdAt: new Date().toISOString(), data: { estoque: estoque, logs: logs } }; const dataStr = JSON.stringify(backupData, null, 2); const blob = new Blob([dataStr], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `backup_estoque_${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
function importarBackup(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const backup = JSON.parse(e.target.result); if (!backup.data || !Array.isArray(backup.data.estoque) || !Array.isArray(backup.data.logs)) { throw new Error("Arquivo de backup inválido ou corrompido."); }
            const confirmacao = confirm("ATENÇÃO!\n\nIsso irá substituir TODOS os dados de estoque e histórico atuais pelos dados do arquivo de backup.\n\nEsta ação não pode ser desfeita.\n\nDeseja continuar?");
            if (confirmacao) { const response = await fetch(`${API_URL}/api/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(backup.data) }); const resData = await response.json(); if (!response.ok) throw new Error(resData.message || "O servidor retornou um erro."); showToast("Backup restaurado com sucesso!"); closeModal(); }
        } catch (error) { showToast("Erro ao importar o backup: " + error.message, 'error'); } finally { event.target.value = ''; }
    };
    reader.readAsText(file);
}