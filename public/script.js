let estoque = [];
let logs = [];
let activeChart = null;
let isFetching = false;

const CATEGORIES = ["HDD", "Memória RAM NB", "Memória RAM PC", "Placa Vídeo / GPU", "SSD M2", "SSD Sata", "Processador", "Placa Mãe", "Telefonia Móvel", "Equipamento Completo", "Infraestrutura", "Fonte / PSU", "Periférico", "Telefonia", "Suprimento", "Outros"];

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.4s forwards';
        setTimeout(() => toast.remove(), 450);
    }, 3000);
}

async function fetchData(force = false) {
    if (isFetching) return;
    if (!force && estoque.length > 0 && logs.length > 0) return;
    isFetching = true;
    try {
        const [eRes, lRes] = await Promise.all([fetch('/api/estoque'), fetch('/api/log')]);
        estoque = await eRes.json();
        logs = await lRes.json();
        // ORDENAÇÃO CRONOLÓGICA RÍGIDA: Mais recente primeiro
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
        showToast('Erro de conexão', 'error');
    } finally { isFetching = false; }
}

async function openModal(templateId, isLarge = false, context = null, isSub = false) {
    const template = document.getElementById(templateId);
    const host = document.getElementById('modal-content-host');
    host.innerHTML = '';
    host.className = isLarge ? 'modal-content modal-lg' : 'modal-content';
    host.appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');

    if (isSub) host.dataset.backTo = 'template-estoque';
    else host.dataset.backTo = '';

    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-estoque') setupEstoqueView();
    if (templateId === 'template-relatorio') setupRelatorioView();
    if (templateId === 'template-retirar') setupFormRetirar(context);
    if (templateId === 'template-excluir') setupFormExcluir(context);
    if (templateId === 'template-editar') setupFormEditar(context);
    if (templateId === 'template-historico-item') setupHistoricoItem(context);
    if (templateId === 'template-dashboard') setupDashboard();
    if (templateId === 'template-observacao') setupObservacaoView(context);
}

function closeModal() {
    const host = document.getElementById('modal-content-host');
    if (activeChart) { activeChart.destroy(); activeChart = null; }
    if (host.dataset.backTo === 'template-estoque') {
        host.dataset.backTo = '';
        openModal('template-estoque', true);
    } else {
        document.getElementById('modal-overlay').classList.remove('active');
    }
}

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    const checkPat = document.getElementById('check-patrimonio');
    checkPat.onchange = () => {
        const container = document.getElementById('pat-input-container');
        const inputQtd = document.getElementById('input-qtd');
        if (checkPat.checked) { container.style.display = 'block'; inputQtd.value = 1; inputQtd.disabled = true; }
        else { container.style.display = 'none'; inputQtd.disabled = false; }
    };
    form.onsubmit = async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-salvar');
        btn.disabled = true;
        
        const timestamp = new Date().toISOString(); // Gera timestamp preciso
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value.trim(),
            quantidade: parseInt(form.quantidade.value),
            patrimonio: checkPat.checked ? document.getElementById('patrimonio-numero').value.trim() : 'N/A',
            observacao: form.observacao.value.trim() || 'N/A',
            timestamp: timestamp
        };

        const ex = estoque.find(i => i.identificacao.toLowerCase() === item.identificacao.toLowerCase() && i.categoria === item.categoria && i.patrimonio === 'N/A' && item.patrimonio === 'N/A');

        if (ex) {
            await fetch(`/api/estoque/${ex.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ quantidade: ex.quantidade + item.quantidade, observacao: item.observacao }) });
        } else {
            await fetch('/api/estoque', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item) });
        }

        await fetch('/api/log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ timestamp, type: 'adicao', categoria: item.categoria, itemName: item.identificacao, quantity: item.quantity || item.quantidade, destino: 'Estoque Central' }) });

        showToast('Item registrado!');
        await fetchData(true);
        form.reset();
        checkPat.checked = false;
        document.getElementById('pat-input-container').style.display = 'none';
        document.getElementById('input-qtd').disabled = false;
        btn.disabled = false;
    };
}

async function setupEstoqueView() {
    await fetchData();
    const sel = document.getElementById('f-est-cat');
    sel.innerHTML = '<option value="">Categorias</option>' + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    filterEstoque();
}

function filterEstoque() {
    const nome = document.getElementById('f-est-nome').value.toLowerCase();
    const pat = document.getElementById('f-est-pat').value.toLowerCase();
    const cat = document.getElementById('f-est-cat').value;
    let filtered = estoque.filter(i => {
        return i.identificacao.toLowerCase().includes(nome) && i.patrimonio.toLowerCase().includes(pat) && (cat === "" || i.categoria === cat);
    });
    document.getElementById('corpo-tabela-estoque').innerHTML = filtered.map(i => `
        <tr>
            <td>${i.categoria}</td>
            <td><b class="item-link" onclick="openModal('template-historico-item', false, '${i.identificacao}', true)">${i.identificacao}</b></td>
            <td>${i.quantidade}</td>
            <td>${i.patrimonio}</td>
            <td>
                <i class="fa-solid fa-eye action-icon" style="color:#2c6e49" title="Ver Obs" onclick="openModal('template-observacao', false, '${i.identificacao}', true)"></i>
                <i class="fa-solid fa-pencil action-icon" style="color:#0077b6" title="Editar" onclick="openModal('template-editar', false, '${i.id}', true)"></i>
                <i class="fa-solid fa-arrow-right-from-bracket action-icon withdraw-icon" title="Retirar" onclick="openModal('template-retirar', false, '${i.id}', true)"></i>
                <i class="fa-solid fa-trash action-icon delete-icon" title="Excluir" onclick="openModal('template-excluir', false, '${i.id}', true)"></i>
            </td>
        </tr>
    `).join('');
}

function setupRelatorioView() {
    const sel = document.getElementById('f-rel-cat');
    sel.innerHTML = '<option value="">Categorias</option>' + CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('');
    filterRelatorio();
}

async function filterRelatorio() {
    await fetchData();
    const nome = document.getElementById('f-rel-nome').value.toLowerCase();
    const cat = document.getElementById('f-rel-cat').value;
    const acao = document.getElementById('f-rel-acao').value;
    const dataI = document.getElementById('f-rel-data-i').value;
    const dataF = document.getElementById('f-rel-data-f').value;
    let filtered = logs.filter(l => {
        const logDate = l.timestamp.split('T')[0];
        return l.itemName.toLowerCase().includes(nome) && (cat === "" || l.categoria === cat) && (acao === "" || l.type === acao) && (dataI === "" || logDate >= dataI) && (dataF === "" || logDate <= dataF);
    });
    document.getElementById('corpo-tabela-log').innerHTML = filtered.map(l => `<tr><td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td><td><b style="color:${l.type==='adicao'?'#2c6e49':l.type==='retirada'?'#fca311':'#d90429'}">${l.type.toUpperCase()}</b></td><td>${l.categoria}</td><td>${l.itemName}</td><td>${l.destino || '---'}</td><td>${l.quantity}</td></tr>`).join('');
}

function setupObservacaoView(itemName) {
    document.getElementById('obs-item-nome').innerText = itemName;
    const registros = estoque.filter(i => i.identificacao.toLowerCase() === itemName.toLowerCase());
    document.getElementById('lista-observacoes').innerHTML = registros.map(r => `<div class="obs-item"><b>Quantidade:</b> ${r.quantidade} | <b>Patrimônio:</b> ${r.patrimonio}<br><b>Obs:</b> ${r.observacao || "---"}</div>`).join('');
}

function setupFormExcluir(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-excluir-item');
    document.getElementById('excluir-nome').value = item.identificacao;
    document.getElementById('max-excluir').innerText = item.quantidade;
    const inputQtd = document.getElementById('excluir-qtd');
    inputQtd.max = item.quantidade;
    inputQtd.value = 1;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const qtd = parseInt(inputQtd.value);
        if (qtd > item.quantidade || qtd <= 0) return showToast('Quantidade inválida', 'error');
        const timestamp = new Date().toISOString();
        if (item.quantidade === qtd) await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
        else await fetch(`/api/estoque/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ quantidade: item.quantidade - qtd }) });
        await fetch('/api/log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ timestamp, type: 'exclusao', categoria: item.categoria, itemName: item.identificacao, quantity: qtd, destino: 'Removido' }) });
        showToast('Removido!');
        await fetchData(true);
        closeModal();
    };
}

function setupFormRetirar(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-retirar-item');
    document.getElementById('retirar-nome').value = item.identificacao;
    document.getElementById('max-retirar').innerText = item.quantidade;
    document.getElementById('retirar-qtd').max = item.quantidade;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('retirar-data').value = now.toISOString().slice(0, 16);
    form.onsubmit = async (e) => {
        e.preventDefault();
        const qtd = parseInt(document.getElementById('retirar-qtd').value);
        const destino = document.getElementById('retirar-destino').value.trim();
        const dtInput = document.getElementById('retirar-data').value;
        const timestamp = new Date(dtInput).toISOString(); // Mantém a ordem se houver segundos
        if (qtd > item.quantidade || qtd <= 0) return showToast('Quantidade inválida', 'error');
        if (item.quantidade === qtd) await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
        else await fetch(`/api/estoque/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ quantidade: item.quantidade - qtd }) });
        await fetch('/api/log', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ timestamp, type: 'retirada', categoria: item.categoria, itemName: item.identificacao, quantity: qtd, destino: destino }) });
        showToast('Saída registrada!');
        await fetchData(true);
        closeModal();
    };
}

function setupFormEditar(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-editar-item');
    const sel = document.getElementById('edit-categoria');
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c}" ${c === item.categoria ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('edit-identificacao').value = item.identificacao;
    document.getElementById('edit-patrimonio').value = item.patrimonio;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const novaIdentificacao = document.getElementById('edit-identificacao').value.trim();
        const novaCategoria = form.categoria.value;
        const novoPatrimonio = document.getElementById('edit-patrimonio').value.trim() || 'N/A';
        if (novoPatrimonio === 'N/A') {
            const alvo = estoque.find(i => i.id !== id && i.identificacao.toLowerCase() === novaIdentificacao.toLowerCase() && i.categoria === novaCategoria && i.patrimonio === 'N/A');
            if (alvo) {
                await fetch(`/api/estoque/${alvo.id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ quantidade: alvo.quantidade + item.quantidade }) });
                await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
                showToast('Item unificado!');
                await fetchData(true);
                closeModal();
                return;
            }
        }
        await fetch(`/api/estoque/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ categoria: novaCategoria, identificacao: novaIdentificacao, patrimonio: novoPatrimonio }) });
        showToast('Atualizado!');
        await fetchData(true);
        closeModal();
    };
}

async function setupHistoricoItem(nome) {
    await fetchData();
    document.getElementById('hist-titulo').innerText = `Histórico: ${nome}`;
    const filtrados = logs.filter(l => l.itemName.toLowerCase() === nome.toLowerCase());
    document.getElementById('corpo-hist-item').innerHTML = filtrados.map(l => `<tr><td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td><td>${l.type.toUpperCase()}</td><td>${l.destino || '---'}</td><td>${l.quantity}</td></tr>`).join('');
}

async function resetBase() {
    if (!confirm('Apagar TUDO?')) return;
    await fetch('/api/reset', { method: 'DELETE' });
    showToast('Base limpa!');
    estoque = []; logs = [];
    closeModal();
}

function exportarXLSX() {
    const data = logs.map(l => ({ 
        "Data/Hora": new Date(l.timestamp).toLocaleString('pt-BR'), 
        "Tipo": l.type === 'adicao' ? 'Adição' : l.type === 'retirada' ? 'Retirada' : 'Exclusão', 
        "Categoria": l.categoria, 
        "Nome": l.itemName, 
        "Quantidade": l.quantity, 
        "Destino": l.destino || '---' 
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatorio");
    XLSX.writeFile(wb, "Estoque_Prefeitura_Relatorio.xlsx");
}

document.getElementById('dashboard-fab').onclick = () => openModal('template-dashboard', true);
async function setupDashboard() {
    await fetchData();
    const ctx = document.getElementById('main-chart-canvas').getContext('2d');
    const data = estoque.reduce((acc, i) => { acc[i.categoria] = (acc[i.categoria] || 0) + i.quantidade; return acc; }, {});
    activeChart = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#2c6e49', '#4c956c', '#ffc9B5', '#d90429', '#0077b6', '#fca311'] }] }, options: { maintainAspectRatio: false } });
}