let estoque = [];
let logs = [];
let activeChart = null;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3500);
}

async function fetchData() {
    try {
        const [eRes, lRes] = await Promise.all([fetch('/api/estoque'), fetch('/api/log')]);
        estoque = await eRes.json();
        logs = await lRes.json();
    } catch (err) {
        showToast('Erro ao conectar com o banco de dados', 'error');
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
    const inputQtd = document.getElementById('input-qtd');
    
    checkPat.onchange = () => {
        const container = document.getElementById('pat-input-container');
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
        btn.innerText = "Processando...";

        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value.trim(),
            quantidade: parseInt(form.quantidade.value),
            patrimonio: checkPat.checked ? document.getElementById('patrimonio-numero').value.trim() : 'N/A',
            observacao: form.observacao.value || '',
            timestamp: new Date().toISOString()
        };

        try {
            await fetchData();
            const existente = estoque.find(i => i.identificacao.toLowerCase() === item.identificacao.toLowerCase() && i.categoria === item.categoria && i.patrimonio === 'N/A');

            if (existente && item.patrimonio === 'N/A') {
                await fetch(`/api/estoque/${existente.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantidade: existente.quantidade + item.quantidade })
                });
            } else {
                await fetch('/api/estoque', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item)
                });
            }

            await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timestamp: item.timestamp,
                    type: 'adicao',
                    categoria: item.categoria,
                    itemName: item.identificacao,
                    quantity: item.quantidade
                })
            });

            showToast('Item registrado com sucesso!');
            closeModal();
        } catch (err) {
            showToast('Erro ao salvar no Firebase', 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = "Salvar Item";
        }
    };
}

async function setupEstoqueView() {
    await fetchData();
    const render = (data) => {
        document.getElementById('corpo-tabela-estoque').innerHTML = data.map(i => `
            <tr>
                <td>${i.categoria}</td>
                <td><span class="item-link" onclick="openModal('template-historico-item', false, '${i.identificacao}')">${i.identificacao}</span></td>
                <td>${i.quantidade}</td>
                <td>${i.patrimonio}</td>
                <td>
                    <i class="fa-solid fa-pencil action-icon edit-icon" title="Editar" onclick="openModal('template-editar', false, '${i.id}')"></i>
                    <i class="fa-solid fa-arrow-trend-down action-icon withdraw-icon" title="Retirar" onclick="retirarItem('${i.id}')"></i>
                    <i class="fa-solid fa-trash-can action-icon delete-icon" title="Excluir" onclick="excluirItem('${i.id}')"></i>
                </td>
            </tr>
        `).join('');
    };
    render(estoque);
    document.getElementById('filtro-texto').onkeyup = (e) => {
        const val = e.target.value.toLowerCase();
        render(estoque.filter(i => i.identificacao.toLowerCase().includes(val) || i.patrimonio.toLowerCase().includes(val)));
    };
}

function setupFormEditar(id) {
    const item = estoque.find(i => i.id === id);
    const form = document.getElementById('form-editar-item');
    const sel = document.getElementById('edit-categoria');
    const cats = ["HDD", "Memória RAM NB", "Memória RAM PC", "Placa Vídeo / GPU", "SSD M2", "SSD Sata", "Processador", "Placa Mãe", "Outros"];
    
    sel.innerHTML = cats.map(c => `<option value="${c}" ${c === item.categoria ? 'selected' : ''}>${c}</option>`).join('');
    document.getElementById('edit-identificacao').value = item.identificacao;

    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetch(`/api/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categoria: form.categoria.value,
                identificacao: form.identificacao.value.trim()
            })
        });
        showToast('Item atualizado!');
        closeModal();
    };
}

async function retirarItem(id) {
    const item = estoque.find(i => i.id === id);
    const qtd = prompt(`Retirar quantos de ${item.identificacao}?`, "1");
    if (!qtd) return;
    const val = parseInt(qtd);
    if (isNaN(val) || val > item.quantidade || val <= 0) return showToast('Qtd inválida', 'error');

    if (item.quantidade === val) {
        await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
    } else {
        await fetch(`/api/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: item.quantidade - val })
        });
    }

    await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'retirada',
            categoria: item.categoria,
            itemName: item.identificacao,
            quantity: val
        })
    });
    showToast('Retirada registrada!');
    setupEstoqueView();
}

async function excluirItem(id) {
    if (!confirm('Deseja apagar este item permanentemente do sistema?')) return;
    await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
    showToast('Item removido!');
    setupEstoqueView();
}

async function setupRelatorioView() {
    await fetchData();
    document.getElementById('corpo-tabela-log').innerHTML = logs.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleString('pt-BR')}</td>
            <td><b style="color:${l.type==='adicao'?'green':'red'}">${l.type.toUpperCase()}</b></td>
            <td>${l.categoria}</td>
            <td>${l.itemName}</td>
            <td>${l.quantity}</td>
        </tr>
    `).join('');
}

async function setupHistoricoItem(nome) {
    await fetchData();
    document.getElementById('hist-titulo').innerText = `Histórico: ${nome}`;
    const filtrados = logs.filter(l => l.itemName.toLowerCase() === nome.toLowerCase());
    document.getElementById('corpo-hist-item').innerHTML = filtrados.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleDateString()}</td>
            <td>${l.type.toUpperCase()}</td>
            <td>${l.quantity}</td>
        </tr>
    `).join('');
}

async function resetBase() {
    if (!confirm('ALERTA CRÍTICO: Isso apagará TODOS os dados para sempre. Confirmar?')) return;
    await fetch('/api/reset', { method: 'DELETE' });
    showToast('Base de dados limpa!');
    closeModal();
}

function exportarXLSX() {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "Relatorio_EstoqueIT.xlsx");
}

document.getElementById('dashboard-fab').onclick = () => openModal('template-dashboard', true);
async function setupDashboard() {
    await fetchData();
    const ctx = document.getElementById('main-chart-canvas').getContext('2d');
    const data = estoque.reduce((acc, i) => {
        acc[i.categoria] = (acc[i.categoria] || 0) + i.quantidade;
        return acc;
    }, {});
    activeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(data),
            datasets: [{ data: Object.values(data), backgroundColor: ['#2c6e49', '#4c956c', '#ffc9B5', '#d90429', '#0077b6', '#fca311'] }]
        },
        options: { maintainAspectRatio: false }
    });
}
document.getElementById('modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') closeModal(); };