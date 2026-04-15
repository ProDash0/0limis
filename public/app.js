let sessionToken = localStorage.getItem('sessionToken');
let currentUser = null;
let currentQueryType = null;

// Initialize session if token exists
if (sessionToken) {
    checkAuth();
}

async function checkAuth() {
    try {
        const res = await fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        if (data.success) {
            setupDashboard(data.user);
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            sessionToken = data.token;
            localStorage.setItem('sessionToken', sessionToken);
            setupDashboard(data.user);
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Erro de conexão.');
    }
}

function setupDashboard(user) {
    currentUser = user;
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    
    document.getElementById('display-user').innerText = user.username;
    document.getElementById('user-token').innerText = user.token;
    
    const expiryDate = new Date(user.expiresAt);
    document.getElementById('display-expiry').innerText = expiryDate.toLocaleDateString();
    if (expiryDate < new Date()) document.getElementById('display-expiry').style.color = 'red';

    const badge = document.querySelector('.logo .badge');
    badge.innerText = user.role.toUpperCase();
    badge.className = `badge ${user.role}`;

    if (user.role === 'admin') {
        document.getElementById('nav-admin').classList.remove('hidden');
    }

    lucide.createIcons();
}

function view(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${name}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');

    if (name === 'logs') loadLogs();
    if (name === 'admin') loadUsers();
}

async function loadUsers() {
    const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const users = await res.json();
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = users.map(u => `
        <tr>
            <td>${u.username}</td>
            <td><code>${u.token}</code></td>
            <td>${new Date(u.expiresAt).toLocaleDateString()}</td>
            <td>
                <button onclick="extendUser('${u.username}')" class="btn-sm">ADICIONAR DIAS</button>
                <button onclick="deleteUser('${u.username}')" class="btn-sm danger">EXCLUIR</button>
            </td>
        </tr>
    `).join('');
}

async function extendUser(username) {
    const days = prompt('Quantos dias deseja adicionar?');
    if (!days) return;
    const res = await fetch('/api/admin/users/extend', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ username, days })
    });
    if (res.ok) loadUsers();
}

async function deleteUser(username) {
    if (!confirm(`Deseja realmente excluir ${username}?`)) return;
    const res = await fetch(`/api/admin/users/${username}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    if (res.ok) loadUsers();
}

async function loadLogs() {
    const res = await fetch('/api/logs', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
    });
    const logs = await res.json();
    const tbody = document.querySelector('#logs-table tbody');
    tbody.innerHTML = logs.map(log => `
        <tr>
            <td><span class="badge ${log.type}">${log.type.toUpperCase()}</span></td>
            <td><code>${log.value}</code></td>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
        </tr>
    `).join('');
}

function openQuery(type) {
    currentQueryType = type;
    document.getElementById('modal-title').innerText = `Consulta ${type.toUpperCase()}`;
    document.getElementById('query-modal').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
}

function closeModal() {
    document.getElementById('query-modal').classList.add('hidden');
}

document.getElementById('btn-search').addEventListener('click', async () => {
    const value = document.getElementById('query-input').value;
    if (!value) return alert('Digite o valor');

    const resultsDiv = document.getElementById('results');
    const output = document.getElementById('json-output');
    
    resultsDiv.classList.remove('hidden');
    output.innerHTML = '<div class="loader">Processando requisição segura...</div>';

    try {
        const url = `/api/consultar?type=${currentQueryType}&value=${encodeURIComponent(value)}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${sessionToken}` }
        });
        const data = await res.json();
        
        if (data.error) {
            output.innerHTML = `<div class="error-text">${data.error}</div>`;
        } else {
            renderTable(data);
        }
    } catch (err) {
        output.innerHTML = 'Erro: ' + err.message;
    }
});

function renderTable(data) {
    const output = document.getElementById('json-output');
    const mainData = data.DADOS || data;
    if (typeof mainData !== 'object' || mainData === null) {
        output.innerText = JSON.stringify(data, null, 2);
        return;
    }

    let html = '<table class="result-table"><tbody>';
    for (const [key, val] of Object.entries(mainData)) {
        if (typeof val === 'object' && val !== null) {
            html += `<tr><th colspan="2" class="table-section">${key.replace(/_/g, ' ')}</th></tr>`;
            for (const [subKey, subVal] of Object.entries(val)) {
                html += `<tr><td class="key">${subKey.replace(/_/g, ' ')}</td><td class="val">${subVal || '-'}</td></tr>`;
            }
        } else {
            html += `<tr><td class="key">${key.replace(/_/g, ' ')}</td><td class="val">${val || '-'}</td></tr>`;
        }
    }
    html += '</tbody></table>';
    html += `<details class="raw-json"><summary>JSON Bruto</summary><pre>${JSON.stringify(data, null, 2)}</pre></details>`;
    output.innerHTML = html;
}

function logout() {
    localStorage.removeItem('sessionToken');
    currentUser = null;
    location.reload();
}

function copyToken() {
    navigator.clipboard.writeText(currentUser.token);
    alert('Token API copiado!');
}

function showRegister() {
    const username = prompt('Novo Usuário:');
    const password = prompt('Nova Senha:');
    if (username && password) {
        fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        }).then(res => res.json())
          .then(data => alert(data.success ? 'Registrado com sucesso!' : data.error));
    }
}
