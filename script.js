import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

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
const genAI = new GoogleGenerativeAI("SUA_GEMINI_API_KEY");

let estoque = [];
let logs = [];

const modalOverlay = document.getElementById('modal-overlay');
const modalContentHost = document.getElementById('modal-content-host');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js');
    });
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

async function fetchData() {
    const estoqueSnapshot = await getDocs(collection(db, "estoque"));
    estoque = estoqueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const logSnapshot = await getDocs(query(collection(db, "logs"), orderBy("timestamp", "desc")));
    logs = logSnapshot.docs.map(doc => doc.data());
}

async function openModal(templateId, isLarge = false, context = null) {
    const template = document.getElementById(templateId);
    modalContentHost.innerHTML = '';
    modalContentHost.className = 'modal-content';
    if (isLarge) modalContentHost.classList.add('modal-lg');
    modalContentHost.appendChild(template.content.cloneNode(true));
    
    if (templateId === 'template-estoque') await setupEstoqueView();
    if (templateId === 'template-adicionar') setupFormAdicionar();
    if (templateId === 'template-relatorio') await setupRelatorioView();
    if (templateId === 'template-editar') setupFormEditar(context);
    if (templateId === 'template-retirar') setupFormRetirar(context);
    
    modalOverlay.classList.add('active');
}

window.closeModal = closeModal;
function closeModal() {
    modalOverlay.classList.remove('active');
}

function setupFormAdicionar() {
    const form = document.getElementById('form-adicionar-item');
    document.getElementById('data').valueAsDate = new Date();
    const radioSim = document.getElementById('patrimonio-sim');
    const containerPatrimonio = document.getElementById('patrimonio-input-container');
    const inputPatrimonio = document.getElementById('patrimonio-numero');
    const inputQuantidade = document.getElementById('quantidade');

    form.addEventListener('change', () => {
        if (radioSim.checked) {
            containerPatrimonio.style.display = 'block';
            inputQuantidade.value = 1;
            inputQuantidade.disabled = true;
        } else {
            containerPatrimonio.style.display = 'none';
            inputQuantidade.disabled = false;
        }
    });

    form.onsubmit = async (e) => {
        e.preventDefault();
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value,
            quantidade: parseInt(inputQuantidade.value),
            patrimonio: radioSim.checked ? inputPatrimonio.value : 'N/A',
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

        showToast('Item adicionado!');
        closeModal();
    };
}

async function setupEstoqueView() {
    await fetchData();
    renderizarEstoque();
}

function renderizarEstoque() {
    const corpo = document.getElementById('corpo-tabela-estoque');
    corpo.innerHTML = '';
    estoque.forEach(item => {
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
}

async function pedirSugestaoIA() {
    try {
        await fetchData();
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Analise este estoque e sugira compras ou alertas: ${JSON.stringify(estoque)}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        alert(response.text());
    } catch (error) {
        showToast('Erro ao contatar Gemini', 'error');
    }
}

window.openModal = openModal;
window.pedirSugestaoIA = pedirSugestaoIA;