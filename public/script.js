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
    }, 3000);
}

async function fetchData() {
    const [eRes, lRes] = await Promise.all([fetch('/api/estoque'), fetch('/api/log')]);
    estoque = await eRes.json();
    logs = await lRes.json();
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
    document.querySelector('input[name="data"]').valueAsDate = new Date();

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
        btn.disabled = true;
        btn.innerText = "Salvando...";

        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value.trim(),
            quantidade: parseInt(form.quantidade.value),
            patrimonio: checkPat.checked ? document.getElementById('patrimonio-numero').value.trim() : 'N/A',
            observacao: form.observacao.value
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
                    timestamp: new Date().toISOString(),
                    type: 'adicao',
                    itemName: item.identificacao,
                    quantity: item.quantidade
                })
            });

            showToast('Item registrado!');
            closeModal();
        } catch (err) {
            showToast('Erro ao salvar', 'error');
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
                    <i class="fa-solid fa-pencil action-icon edit-icon" onclick="openModal('template-editar', false, '${i.id}')"></i>
                    <i class="fa-solid fa-arrow-down action-icon withdraw-icon" onclick="retirarItem('${i.id}')"></i>
                    <i class="fa-solid fa-trash action-icon delete-icon" onclick="excluirItem('${i.id}')"></i>
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
        const btn = document.getElementById('btn-editar-salvar');
        btn.disabled = true;

        await fetch(`/api/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                categoria: form.categoria.value,
                identificacao: form.identificacao.value.trim()
            })
        });

        showToast('Atualizado!');
        closeModal();
    };
}

async function retirarItem(id) {
    const item = estoque.find(i => i.id === id);
    const qtd = prompt(`Retirar quantos de ${item.identificacao}?`, "1");
    if (!qtd) return;
    const valor = parseInt(qtd);
    if (valor > item.quantidade || valor <= 0) return showToast('Quantidade inválida', 'error');

    if (item.quantidade === valor) {
        await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
    } else {
        await fetch(`/api/estoque/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantidade: item.quantidade - valor })
        });
    }

    await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            timestamp: new Date().toISOString(),
            type: 'retirada',
            itemName: item.identificacao,
            quantity: valor
        })
    });
    showToast('Retirado!');
    setupEstoqueView();
}

async function excluirItem(id) {
    if (!confirm('Excluir este item permanentemente?')) return;
    await fetch(`/api/estoque/${id}`, { method: 'DELETE' });
    showToast('Excluído!');
    setupEstoqueView();
}

async function setupRelatorioView() {
    await fetchData();
    document.getElementById('corpo-tabela-log').innerHTML = logs.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleString()}</td>
            <td>${l.type.toUpperCase()}</td>
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
    if (!confirm('ATENÇÃO: Isso apagará TODO o estoque e histórico. Continuar?')) return;
    await fetch('/api/reset', { method: 'DELETE' });
    showToast('Base reiniciada!');
    closeModal();
}

function exportarXLSX() {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Movimentações");
    XLSX.writeFile(wb, "Relatorio_Estoque.xlsx");
}

document.getElementById('dashboard-fab').onclick = () => openModal('template-dashboard', true);
async function setupDashboardView() {
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
            datasets: [{ data: Object.values(data), backgroundColor: ['#2c6e49', '#4c956c', '#ffc9B5', '#d90429', '#0077b6'] }]
        }
    });
}