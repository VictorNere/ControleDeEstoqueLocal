const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const LOG_PATH = path.join(__dirname, 'database_log.json');

// --- Funções Auxiliares (sem alterações) ---
function readFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filePath}:`, error);
        return [];
    }
}

function writeFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Erro ao escrever no arquivo ${filePath}:`, error);
    }
}

function validarEstoque(estoque) {
    const patrimonios = new Set();
    for (const item of estoque) {
        if (item.patrimonio && item.patrimonio !== 'N/A') {
            if (patrimonios.has(item.patrimonio.toLowerCase())) {
                return { valido: false, erro: `Patrimônio duplicado encontrado: ${item.patrimonio}` };
            }
            patrimonios.add(item.patrimonio.toLowerCase());
        }
    }
    return { valido: true };
}

// --- Criação do Servidor ---
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
        // Rota para a página principal
        if (req.url === '/' && req.method === 'GET') {
            fs.readFile(path.join(__dirname, 'index.html'), (err, content) => {
                if (err) { res.writeHead(500); res.end('Erro no servidor'); return; }
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            });
        }
        // --- INÍCIO DA CORREÇÃO ---
        // Adiciona a capacidade de servir o arquivo style.css
        else if (req.url === '/style.css' && req.method === 'GET') {
            fs.readFile(path.join(__dirname, 'style.css'), (err, content) => {
                if (err) { res.writeHead(500); res.end('Erro no servidor'); return; }
                res.writeHead(200, { 'Content-Type': 'text/css' });
                res.end(content);
            });
        }
        // Adiciona a capacidade de servir o arquivo script.js
        else if (req.url === '/script.js' && req.method === 'GET') {
            fs.readFile(path.join(__dirname, 'script.js'), (err, content) => {
                if (err) { res.writeHead(500); res.end('Erro no servidor'); return; }
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(content);
            });
        }
        // --- FIM DA CORREÇÃO ---
        else if (req.url === '/api/estoque') {
            if (req.method === 'GET') {
                const estoque = readFile(DB_PATH);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(estoque));
            } else if (req.method === 'POST') {
                const novoEstoque = JSON.parse(body);
                const validacao = validarEstoque(novoEstoque);
                if (!validacao.valido) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: validacao.erro }));
                    return;
                }
                writeFile(DB_PATH, novoEstoque);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Estoque salvo!' }));
            }
        }
        else if (req.url === '/api/log') {
            if (req.method === 'GET') {
                const log = readFile(LOG_PATH);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(log));
            } else if (req.method === 'POST') {
                const logEntry = JSON.parse(body);
                const logs = readFile(LOG_PATH);
                logs.push(logEntry);
                writeFile(LOG_PATH, logs);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Log salvo!' }));
            }
        }
        else if (req.url === '/api/restore' && req.method === 'POST') {
            try {
                const backupData = JSON.parse(body);
                if (backupData.estoque && backupData.logs) {
                    const validacao = validarEstoque(backupData.estoque);
                    if (!validacao.valido) {
                        throw new Error(validacao.erro);
                    }
                    writeFile(DB_PATH, backupData.estoque);
                    writeFile(LOG_PATH, backupData.logs);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Backup restaurado com sucesso!' }));
                } else {
                    throw new Error('Estrutura do backup inválida.');
                }
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Erro ao processar o arquivo de backup.', error: error.message }));
            }
        }
        else {
            res.writeHead(404);
            res.end('Não encontrado');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Servidor moderno rodando em http://10.1.1.117:${PORT}`);
    console.log('Para parar o servidor, pressione Ctrl + C no terminal.');
});