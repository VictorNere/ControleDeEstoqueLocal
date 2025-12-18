import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "ID",
    appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let estoque = [];
let logs = [];

const modalContentHost = document.getElementById('modal-content-host');
const modalOverlay = document.getElementById('modal-overlay');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js'); });
}

function showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s forwards';
        toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
}

window.openModal = async function(templateId, isLarge = false) {
    const template = document.getElementById(templateId);
    modalContentHost.innerHTML = '';
    modalContentHost.className = 'modal-content' + (isLarge ? ' modal-lg' : '');
    modalContentHost.appendChild(template.content.cloneNode(true));
    modalOverlay.classList.add('active');

    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-estoque') await setupEstoqueView();
    if (templateId === 'template-relatorio') await setupRelatorioView();
};

window.closeModal = function() { modalOverlay.classList.remove('active'); };

async function fetchData() {
    const estoqueSnap = await getDocs(collection(db, "estoque"));
    estoque = estoqueSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const logSnap = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc")));
    logs = logSnap.docs.map(d => d.data());
}

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    document.getElementById('data').valueAsDate = new Date();
    
    const radioSim = document.getElementById('patrimonio-sim');
    const radioNao = document.getElementById('patrimonio-nao');
    const containerPat = document.getElementById('patrimonio-input-container');
    const inputQtd = document.getElementById('quantidade');

    radioSim.addEventListener('change', () => { containerPat.style.display = 'block'; inputQtd.value = 1; inputQtd.disabled = true; });
    radioNao.addEventListener('change', () => { containerPat.style.display = 'none'; inputQtd.disabled = false; });

    const salvarItem = async (fechar) => {
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value,
            quantidade: parseInt(inputQtd.value),
            patrimonio: radioSim.checked ? document.getElementById('patrimonio-numero').value : 'N/A',
            dataEntrada: form.data.value
        };

        try {
            await addDoc(collection(db, "estoque"), item);
            await addDoc(collection(db, "logs"), {
                timestamp: new Date().toISOString(),
                type: 'adicao',
                itemName: item.identificacao,
                quantity: item.quantidade,
                observacao: form.observacao.value
            });
            showToast('Item salvo com sucesso!');
            if (fechar) closeModal(); else form.reset();
        } catch (e) { showToast('Erro ao salvar!', 'error'); }
    };

    form.onsubmit = (e) => { e.preventDefault(); salvarItem(true); };
    document.getElementById('btn-salvar-outro').onclick = () => salvarItem(false);
}

async function setupEstoqueView() {
    await fetchData();
    renderEstoque(estoque);
    document.getElementById('filtro-texto').oninput = (e) => {
        const val = e.target.value.toLowerCase();
        renderEstoque(estoque.filter(i => i.identificacao.toLowerCase().includes(val) || i.categoria.toLowerCase().includes(val)));
    };
}

function renderEstoque(dados) {
    const corpo = document.getElementById('corpo-tabela-estoque');
    corpo.innerHTML = '';
    dados.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${item.categoria}</td><td>${item.identificacao}</td><td>${item.quantidade}</td><td>${item.patrimonio}</td><td><button class="delete-btn" onclick="deleteItem('${item.id}')"><i class="fa-solid fa-trash"></i></button></td>`;
        corpo.appendChild(tr);
    });
}

window.deleteItem = async function(id) {
    if(confirm('Deseja excluir este item?')) {
        await deleteDoc(doc(db, "estoque", id));
        showToast('Item excluído');
        setupEstoqueView();
    }
};

async function setupRelatorioView() {
    await fetchData();
    document.getElementById('total-items-summary').textContent = estoque.reduce((a, b) => a + (b.quantidade || 0), 0);
    document.getElementById('total-moves-summary').textContent = logs.length;
    const corpo = document.getElementById('corpo-tabela-log');
    corpo.innerHTML = logs.map(l => `<tr><td>${new Date(l.timestamp).toLocaleDateString()}</td><td>${l.type}</td><td>${l.itemName}</td><td>${l.quantity}</td><td>${l.observacao || ''}</td></tr>`).join('');
}