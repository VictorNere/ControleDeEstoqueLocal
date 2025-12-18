import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
const genAI = new GoogleGenerativeAI("SUA_GEMINI_KEY");

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
}

window.openModal = function(id, lg = false) {
    const host = document.getElementById('modal-content-host');
    const template = document.getElementById(id);
    host.innerHTML = '';
    if(lg) host.classList.add('modal-lg');
    host.appendChild(template.content.cloneNode(true));
    document.getElementById('modal-overlay').classList.add('active');
    if(id === 'template-adicionar') setupAddForm();
    if(id === 'template-estoque') loadEstoque();
};

window.closeModal = function() {
    document.getElementById('modal-overlay').classList.remove('active');
};

function setupAddForm() {
    const form = document.getElementById('form-adicionar-item');
    const pSim = document.getElementById('p-sim');
    const patCont = document.getElementById('pat-container');
    pSim.onchange = () => patCont.style.display = 'block';
    document.getElementById('p-nao').onchange = () => patCont.style.display = 'none';

    form.onsubmit = async (e) => {
        e.preventDefault();
        const item = {
            categoria: form.categoria.value,
            identificacao: form.identificacao.value,
            quantidade: parseInt(form.quantidade.value),
            patrimonio: pSim.checked ? form.patrimonio.value : 'N/A',
            data: new Date().toISOString()
        };
        await addDoc(collection(db, "estoque"), item);
        closeModal();
    };
}

async function loadEstoque() {
    const snap = await getDocs(collection(db, "estoque"));
    const corpo = document.getElementById('corpo-estoque');
    corpo.innerHTML = '';
    snap.forEach(doc => {
        const data = doc.data();
        corpo.innerHTML += `<tr><td>${data.categoria}</td><td>${data.identificacao}</td><td>${data.quantidade}</td><td>${data.patrimonio}</td></tr>`;
    });
}

window.analisarComGemini = async function() {
    const snap = await getDocs(collection(db, "estoque"));
    let dados = [];
    snap.forEach(d => dados.push(d.data()));
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `Analise este estoque de TI e dê uma sugestão curta: ${JSON.stringify(dados)}`;
    const result = await model.generateContent(prompt);
    alert(result.response.text());
};