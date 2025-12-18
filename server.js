const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const app = express();

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
        process.exit(1);
    }
} else {
    try {
        serviceAccount = require("./serviceAccountKey.json");
    } catch (e) {
        process.exit(1);
    }
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/estoque', async (req, res) => {
    try {
        const snapshot = await db.collection('estoque').get();
        const estoque = snapshot.docs.map(doc => ({ firebaseId: doc.id, ...doc.data() }));
        res.json(estoque);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/estoque', async (req, res) => {
    try {
        const novoEstoque = req.body;
        const batch = db.batch();
        const snapshot = await db.collection('estoque').get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        novoEstoque.forEach(item => {
            const docRef = db.collection('estoque').doc();
            batch.set(docRef, item);
        });
        await batch.commit();
        res.json({ message: 'Sucesso' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/log', async (req, res) => {
    try {
        const snapshot = await db.collection('logs').orderBy('timestamp', 'desc').get();
        const logs = snapshot.docs.map(doc => doc.data());
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/log', async (req, res) => {
    try {
        await db.collection('logs').add(req.body);
        res.json({ message: 'Sucesso' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});