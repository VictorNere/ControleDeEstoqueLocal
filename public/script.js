let estoque = [];
let logs = [];
let activeChart = null;

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

async function fetchData() {
    try {
        const [eRes, lRes] = await Promise.all([fetch('/api/estoque'), fetch('/api/log')]);
        estoque = await eRes.json();
        logs = await lRes.json();
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (err) {
        showToast('Erro ao carregar dados', 'error');
    }
}

async function openModal(templateId, isLarge = false, context = null) {
    const template = document.getElementById(templateId);
    const host = document.getElementById('modal-content-host');
    host.innerHTML = '';
    host.className = isLarge ? 'modal-content modal-lg' : 'modal-content';
    host.appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');

    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-estoque') setupEstoqueView();
    if (templateId === 'template-relatorio') setupRelatorioView();
    if (templateId === 'template-retirar') setupFormRetirar(context);
    if (templateId === 'template-editar') setupFormEditar(context);
    if (templateId === 'template-historico-item') setupHistoricoItem(context);
    if (templateId === 'template-dashboard') setupDashboard();
}

function closeModal() {
    if (activeChart) { activeChart.destroy(); activeChart = null; }
    document.getElementById('modal-overlay').classList.remove('active');
}

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    const btn = document.getElementById('btn-salvar');
    const checkPat = document.getElementById('check-patrimonio');
    
    checkPat.onchange = () => {
        const container = document.getElementById('pat-input-container');
        const inputQtd = document.getElementById('input-qtd');
        if (checkPat.checked) {
            container.style.display = 'block';
            inputQtd.value = 1;
            inputQtd.disabled = true;
        } else {
            container.style.display = 'none';
            inputQtd.disabled = false;
        }
    };

    form.onsubmit = async (e) => {
        e.preventDefault();
        if (btn.disabled) return;
        btn.disabled = true;

        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value.trim(),
            quantidade: parseInt(form.quantidade.value),
            patrimonio: checkPat.checked ? document.getElementById('patrimonio-numero').value.trim() : 'N/A',
            timestamp: new Date().toISOString()
        };

        await fetchData();
        const ex = estoque.find(i => i.identificacao.toLowerCase() === item.identificacao.toLowerCase() && i.categoria === item.categoria && i.patrimonio === 'N/A' && item.patrimonio === 'N/A');

        if (ex) {
            await fetch(`/api/estoque/${ex.id}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ quantidade: ex.quantidade + item.quantidade })
            });
        } else {
            await fetch('/api/estoque', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(item)
            });
        }

        await fetch('/api/log', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                timestamp: item.timestamp,
                type: 'adicao',
                categoria: item.categoria,
                itemName: item.identificacao,
                quantity: item.quantidade,
                destino: 'Estoque Central'
            })
        });

        showToast('Item registrado!');
        closeModal();
    };
}

async function setupEstoqueView() {
    await fetchData();
    filterEstoque();
}

function filterEstoque() {
    const nome = document.getElementById('f-est-nome').value.toLowerCase();
    const cat = document.getElementById('f-est-cat').value;
    
    let filtered = estoque.filter(i => {
        const matchNome = i.identificacao.toLowerCase().includes(nome) || i.patrimonio.toLowerCase().includes(nome);
        const matchCat = cat === "" || i.categoria === cat;
        return matchNome && matchCat;
    });

    document.getElementById('corpo-tabela-estoque').innerHTML = filtered.map(i => `
        <tr>
            <td>${i.categoria}</td>
            <td><b class="item-link" onclick="openModal('template-historico-item', false, '${i.identificacao}')">${i.identificacao}</b></td>
            <td>${i.quantidade}</td>
            <td>${i.patrimonio}</td>
            <td>
                <i class="fa-solid fa-pencil action-icon" style="color:#0077b6" onclick="openModal('template-editar', false, '${i.id}')"></i>
                <i class="fa-solid fa-arrow-right-from-bracket action-icon withdraw-icon" onclick="openModal('template-retirar', false, '${i.id}')"></i>
                <i class="fa-solid fa-trash action-icon delete-icon" onclick="excluirItem('${i.id}')"></i>
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
        const mNome = l.itemName.toLowerCase().includes(nome);
        const mCat = cat === "" || l.categoria === cat;
        const mAcao = acao === "" || l.type === acao;
        const logDate = l.timestamp.split('T')[0];
        const mDataI = dataI === "" || logDate >= dataI;
        const mDataF = dataF === "" || logDate <= dataF;
        return mNome && mCat && mAcao && mDataI && mDataF;
    });

    document.getElementById('corpo-tabela-log').innerHTML = filtered.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td>
            <td><b style="color:${l.type==='adicao'?'#2c6e49':'#d90429'}">${l.type.toUpperCase()}</b></td>
            <td>${l.categoria}</td>
            <td>${l.itemName}</td>
            <td>${l.destino || '---'}</td>
            <td>${l.quantity}</td>
        </tr>
    `).join('');
}

function setupFormEditar(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-editar-item');
    const sel = document.getElementById('edit-categoria');
    sel.innerHTML = CATEGORIES.map(c => `<option value="${c}" ${c === item.categoria ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('edit-identificacao').value = item.identificacao;

    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetch(`/api/estoque/${id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ categoria: form.categoria.value, identificacao: form.identificacao.value.trim() })
        });
        showToast('Atualizado!');
        closeModal();
    };
}

function setupFormRetirar(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-retirar-item');
    document.getElementById('retirar-nome').value = item.identificacao;
    document.getElementById('max-retirar').innerText = item.quantidade;
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('retirar-data').value = now.toISOString().slice(0, 16);

    form.onsubmit = async (e) => {
        e.preventDefault();
        const qtd = parseInt(document.getElementById('retirar-qtd').value);
        const destino = document.getElementById('retirar-destino').value.trim();
        const dt = document.getElementById('retirar-data').value;
        if (qtd > item.quantidade || qtd <= 0) return showToast('Quantidade inválida', 'error');

        if (item.quantidade === qtd) await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
        else await fetch(`/api/estoque/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ quantidade: item.quantidade - qtd }) });

        await fetch('/api/log', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ timestamp: new Date(dt).toISOString(), type: 'retirada', categoria: item.categoria, itemName: item.identificacao, quantity: qtd, destino: destino })
        });
        showToast('Retirada registrada!');
        closeModal();
    };
}

async function excluirItem(id) {
    if (!confirm('Excluir permanentemente?')) return;
    await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
    showToast('Removido');
    setupEstoqueView();
}

async function setupHistoricoItem(nome) {
    await fetchData();
    document.getElementById('hist-titulo').innerText = `Histórico: ${nome}`;
    const filtrados = logs.filter(l => l.itemName.toLowerCase() === nome.toLowerCase());
    document.getElementById('corpo-hist-item').innerHTML = filtrados.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td>
            <td>${l.type.toUpperCase()}</td>
            <td>${l.destino || '---'}</td>
            <td>${l.quantity}</td>
        </tr>
    `).join('');
}

async function resetBase() {
    if (!confirm('Deseja apagar TUDO?')) return;
    await fetch('/api/reset', { method: 'DELETE' });
    showToast('Base limpa!');
    closeModal();
}

function exportarXLSX() {
    const data = logs.map(l => ({ "Data/Hora": new Date(l.timestamp).toLocaleString('pt-BR'), "Tipo": l.type === 'adicao' ? 'Adição' : 'Retirada', "Categoria": l.categoria, "Nome": l.itemName, "Quantidade": l.quantity, "Destino": l.destino || 'Estoque Central' }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, "Relatorio_Estoque.xlsx");
}

document.getElementById('dashboard-fab').onclick = () => openModal('template-dashboard', true);
async function setupDashboard() {
    await fetchData();
    const ctx = document.getElementById('main-chart-canvas').getContext('2d');
    const data = estoque.reduce((acc, i) => { acc[i.categoria] = (acc[i.categoria] || 0) + i.quantidade; return acc; }, {});
    activeChart = new Chart(ctx, { type: 'pie', data: { labels: Object.keys(data), datasets: [{ data: Object.values(data), backgroundColor: ['#2c6e49', '#4c956c', '#ffc9B5', '#d90429', '#0077b6', '#fca311'] }] }, options: { maintainAspectRatio: false } });
}