let estoque = [];
let logs = [];
let activeChart = null;

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

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

async function openModal(templateId, isLarge = false) {
    const template = document.getElementById(templateId);
    const host = document.getElementById('modal-content-host');
    host.innerHTML = '';
    host.className = isLarge ? 'modal-content modal-lg' : 'modal-content';
    host.appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');

    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-estoque') setupEstoqueView();
    if (templateId === 'template-relatorio') setupRelatorioView();
    if (templateId === 'template-dashboard') setupDashboardView();
}

function closeModal() {
    if (activeChart) { activeChart.destroy(); activeChart = null; }
    document.getElementById('modal-overlay').classList.remove('active');
}

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    document.getElementById('data').valueAsDate = new Date();
    form.querySelector('#p-sim').onclick = () => document.getElementById('pat-input-container').style.display = 'block';
    form.querySelector('#p-nao').onclick = () => document.getElementById('pat-input-container').style.display = 'none';

    form.onsubmit = async (e) => {
        e.preventDefault();
        await fetchData();
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value.trim(),
            quantidade: parseInt(form.quantidade.value),
            patrimonio: form.p.value === 'sim' ? form.querySelector('#patrimonio-numero').value.trim() : 'N/A'
        };

        let novoEstoque = [...estoque];
        const existente = novoEstoque.find(i => i.identificacao === item.identificacao && i.categoria === item.categoria && i.patrimonio === 'N/A');

        if (existente && item.patrimonio === 'N/A') {
            existente.quantidade += item.quantidade;
        } else {
            novoEstoque.push(item);
        }

        const res = await fetch('/api/estoque', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(novoEstoque)
        });

        if (res.ok) {
            await fetch('/api/log', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    timestamp: new Date().toISOString(),
                    type: 'adicao',
                    categoria: item.categoria,
                    itemName: item.identificacao,
                    quantity: item.quantidade
                })
            });
            showToast('Salvo!');
            closeModal();
        }
    };
}

async function setupEstoqueView() {
    await fetchData();
    renderEstoqueTable(estoque);
    document.getElementById('filtro-texto').onkeyup = (e) => {
        const val = e.target.value.toLowerCase();
        renderEstoqueTable(estoque.filter(i => i.identificacao.toLowerCase().includes(val) || i.patrimonio.toLowerCase().includes(val)));
    };
}

function renderEstoqueTable(data) {
    document.getElementById('corpo-tabela-estoque').innerHTML = data.map(i => `
        <tr>
            <td>${i.categoria}</td>
            <td>${i.identificacao}</td>
            <td>${i.quantidade}</td>
            <td>${i.patrimonio}</td>
            <td><button class="action-btn" onclick="retirarItem('${i.firebaseId}')">Retirar</button></td>
        </tr>
    `).join('');
}

async function retirarItem(fId) {
    await fetchData();
    const item = estoque.find(i => i.firebaseId === fId);
    const qtd = prompt(`Retirar quantos de ${item.identificacao}? (Máx: ${item.quantidade})`, "1");
    const valor = parseInt(qtd);
    if (!valor || valor <= 0 || valor > item.quantidade) return;

    item.quantidade -= valor;
    const novoEstoque = item.quantidade === 0 ? estoque.filter(i => i.firebaseId !== fId) : estoque;

    const res = await fetch('/api/estoque', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(novoEstoque.map(({firebaseId, ...rest}) => rest))
    });

    if (res.ok) {
        await fetch('/api/log', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                timestamp: new Date().toISOString(),
                type: 'retirada',
                categoria: item.categoria,
                itemName: item.identificacao,
                quantity: valor
            })
        });
        showToast('Retirado!');
        setupEstoqueView();
    }
}

async function setupRelatorioView() {
    await fetchData();
    document.getElementById('corpo-tabela-log').innerHTML = logs.map(l => `
        <tr>
            <td>${new Date(l.timestamp).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}</td>
            <td>${l.type.toUpperCase()}</td>
            <td>${l.categoria}</td>
            <td>${l.itemName}</td>
            <td>${l.quantity}</td>
        </tr>
    `).join('');
}

function exportarXLSX() {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "estoque_relatorio.xlsx");
}

async function setupDashboardView() {
    await fetchData();
    showDashboardMenu();
}

function showDashboardMenu() {
    if (activeChart) activeChart.destroy();
    const content = document.getElementById('dashboard-content');
    content.innerHTML = document.getElementById('sub-template-dashboard-menu').innerHTML;
}

function showChart(type) {
    const content = document.getElementById('dashboard-content');
    content.innerHTML = document.getElementById('sub-template-chart-view').innerHTML;
    const ctx = document.getElementById('main-chart-canvas').getContext('2d');
    const ctrl = document.getElementById('chart-controls');

    if (type === 'comparacaoItemTotal') {
        const itens = [...new Set(logs.map(l => l.itemName))].sort();
        ctrl.innerHTML = `<select id="sel-item"><option value="">Selecione...</option>${itens.map(n => `<option value="${n}">${n}</option>`).join('')}</select>`;
        document.getElementById('sel-item').onchange = (e) => {
            if (activeChart) activeChart.destroy();
            const total = estoque.reduce((s, i) => s + i.quantidade, 0);
            const itemQtd = estoque.filter(i => i.identificacao === e.target.value).reduce((s, i) => s + i.quantidade, 0);
            activeChart = new Chart(ctx, { type: 'bar', data: { labels: ['Total', e.target.value], datasets: [{ data: [total, itemQtd], backgroundColor: ['#2c6e49', '#ffc9B5'] }] }, options: { maintainAspectRatio: false } });
        };
    }
}

document.getElementById('dashboard-fab').onclick = () => openModal('template-dashboard', true);
document.getElementById('modal-overlay').onclick = (e) => { if (e.target.id === 'modal-overlay') closeModal(); };