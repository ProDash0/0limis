let currentUser = null;
let currentQueryType = null;

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username) return alert('Digite o usuário');

    try {
        const res = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (data.success) {
            currentUser = data.user;
            document.getElementById('auth-section').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            
            // UI Updates
            document.getElementById('display-user').innerText = currentUser.username;
            document.getElementById('user-token').innerText = currentUser.token;
            
            const badge = document.querySelector('.logo .badge');
            badge.innerText = currentUser.role.toUpperCase();
            badge.className = `badge ${currentUser.role}`;

            document.getElementById('base-url-doc').innerText = `${window.location.origin}/api/consultar`;
            
            updateDocExamples();
            loadLogs();
            lucide.createIcons();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Erro ao conectar ao servidor');
    }
}

function updateDocExamples() {
    const baseUrl = window.location.origin;
    const examplePre = document.querySelector('#view-documentacao pre');
    examplePre.innerHTML = `<span>GET</span> ${baseUrl}/api/consultar?type=cpf&value=92796095134&token=${currentUser.token}`;
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
          .then(data => {
              if (data.success) alert('Registrado! Agora faça login.');
              else alert(data.error);
          });
    }
}

function logout() {
    currentUser = null;
    location.reload();
}

function copyToken() {
    navigator.clipboard.writeText(currentUser.token);
    alert('Token copiado!');
}

function view(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${name}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Handle both event triggering and direct calls
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    if (name === 'logs') loadLogs();
}

async function loadLogs() {
    try {
        const res = await fetch(`/api/logs?token=${currentUser.token}`);
        const logs = await res.json();
        const tbody = document.querySelector('#logs-table tbody');
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td><span class="badge ${log.type}">${log.type.toUpperCase()}</span></td>
                <td><code>${log.value}</code></td>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Erro ao carregar logs:', err);
    }
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
    output.innerHTML = '<div class="loader">Consultando banco de dados...</div>';

    try {
        const url = `/api/consultar?type=${currentQueryType}&value=${encodeURIComponent(value)}&token=${currentUser.token}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            output.innerHTML = `<div class="error-text">${data.error}</div>`;
        } else {
            renderTable(data);
        }
        loadLogs(); // Refresh logs after query
    } catch (err) {
        output.innerHTML = 'Erro: ' + err.message;
    }
});

function renderTable(data) {
    const output = document.getElementById('json-output');
    
    // If it's the standard format with DADOS
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
    html += `<details class="raw-json"><summary>Ver JSON Bruto</summary><pre>${JSON.stringify(data, null, 2)}</pre></details>`;
    
    output.innerHTML = html;
}

lucide.createIcons();
