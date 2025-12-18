import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_ID",
    appId: "SEU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let estoque = [];
let logs = [];

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); });
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
    const estoqueSnap = await getDocs(collection(db, "estoque"));
    estoque = estoqueSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const logSnap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc")));
    logs = logSnap.docs.map(d => d.data());
}

window.openModal = async function(templateId, isLarge = false, contextId = null) {
    const template = document.getElementById(templateId);
    const host = document.getElementById('modal-content-host');
    const overlay = document.getElementById('modal-overlay');
    
    host.innerHTML = '';
    host.className = 'modal-content' + (isLarge ? ' modal-lg' : '');
    host.appendChild(template.content.cloneNode(true));
    overlay.classList.add('active');

    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-estoque') await setupEstoqueView();
    if (templateId === 'template-relatorio') await setupRelatorioView();
    if (templateId === 'template-editar') setupFormEditar(contextId);
    if (templateId === 'template-retirar') setupFormRetirar(contextId);
};

window.closeModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    document.getElementById('data').valueAsDate = new Date();
    
    const radioSim = document.getElementById('patrimonio-sim');
    const radioNao = document.getElementById('patrimonio-nao');
    const containerPat = document.getElementById('patrimonio-input-container');
    const inputQtd = document.getElementById('quantidade');

    radioSim.onchange = () => { containerPat.style.display = 'block'; inputQtd.value = 1; inputQtd.disabled = true; };
    radioNao.onchange = () => { containerPat.style.display = 'none'; inputQtd.disabled = false; };

    form.onsubmit = async (e) => {
        e.preventDefault();
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value,
            quantidade: parseInt(form.quantidade.value),
            patrimonio: radioSim.checked ? document.getElementById('patrimonio-numero').value : 'N/A',
            dataEntrada: form.data.value
        };

        await addDoc(collection(db, "estoque"), item);
        await addDoc(collection(db, "logs"), {
            timestamp: new Date().toISOString(),
            type: 'adicao',
            itemName: item.identificacao,
            quantity: item.quantidade,
            observacao: form.observacao.value
        });

        showToast('Item adicionado com sucesso!');
        closeModal();
    };
}

async function setupEstoqueView() {
    await fetchData();
    const corpo = document.getElementById('corpo-tabela-estoque');
    const filtro = document.getElementById('filtro-texto');
    
    const render = (dados) => {
        corpo.innerHTML = '';
        dados.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.categoria}</td>
                <td>${item.identificacao}</td>
                <td>${item.quantidade}</td>
                <td>${item.patrimonio}</td>
                <td>
                    <button onclick="openModal('template-editar', false, '${item.id}')"><i class="fa-solid fa-pencil"></i></button>
                    <button onclick="openModal('template-retirar', false, '${item.id}')"><i class="fa-solid fa-arrow-down"></i></button>
                </td>
            `;
            corpo.appendChild(tr);
        });
    };

    filtro.oninput = () => {
        const val = filtro.value.toLowerCase();
        render(estoque.filter(i => i.identificacao.toLowerCase().includes(val) || i.categoria.toLowerCase().includes(val)));
    };

    render(estoque);
}

async function setupRelatorioView() {
    await fetchData();
    document.getElementById('total-items-summary').textContent = estoque.reduce((a, b) => a + b.quantidade, 0);
    document.getElementById('total-moves-summary').textContent = logs.length;
    
    const corpo = document.getElementById('corpo-tabela-log');
    corpo.innerHTML = '';
    logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(log.timestamp).toLocaleDateString()}</td>
            <td>${log.type}</td>
            <td>${log.itemName}</td>
            <td>${log.quantity}</td>
            <td>${log.observacao || '-'}</td>
        `;
        corpo.appendChild(tr);
    });
}

async function setupFormEditar(id) {
    const itemRef = doc(db, "estoque", id);
    const itemSnap = await getDoc(itemRef);
    const item = itemSnap.data();
    
    document.getElementById('editar-id').value = id;
    document.getElementById('identificacao-editar').value = item.identificacao;

    document.getElementById('form-editar-item').onsubmit = async (e) => {
        e.preventDefault();
        await updateDoc(itemRef, { identificacao: document.getElementById('identificacao-editar').value });
        showToast('Item atualizado!');
        closeModal();
    };
}

async function setupFormRetirar(id) {
    const itemRef = doc(db, "estoque", id);
    const itemSnap = await getDoc(itemRef);
    const item = itemSnap.data();

    document.getElementById('form-retirar-item').onsubmit = async (e) => {
        e.preventDefault();
        const qtdRetirar = parseInt(document.getElementById('quantidade-retirar').value);
        
        if (qtdRetirar > item.quantidade) return showToast('Estoque insuficiente!', 'error');

        if (item.quantidade === qtdRetirar) {
            await deleteDoc(itemRef);
        } else {
            await updateDoc(itemRef, { quantidade: item.quantidade - qtdRetirar });
        }

        await addDoc(collection(db, "logs"), {
            timestamp: new Date().toISOString(),
            type: 'retirada',
            itemName: item.identificacao,
            quantity: qtdRetirar,
            observacao: 'Saída de estoque'
        });

        showToast('Retirada concluída!');
        closeModal();
    };
}