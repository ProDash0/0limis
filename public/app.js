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
            document.getElementById('display-user').innerText = currentUser.username;
            document.getElementById('user-token').innerText = currentUser.token;
            document.getElementById('base-url-doc').innerText = `${window.location.origin}/api/consultar`;
            
            // Re-render icons after DOM change
            lucide.createIcons();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Erro ao conectar ao servidor');
    }
}

function showRegister() {
    // For demo, just reuse login as a simple way to create user
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
    alert('Token copiado para a área de transferência!');
}

function view(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${name}`).classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function openQuery(type) {
    currentQueryType = type;
    document.getElementById('modal-title').innerText = `Consulta ${type.toUpperCase()}`;
    document.getElementById('query-modal').classList.remove('hidden');
    document.getElementById('json-output').innerText = '// Aguardando consulta...';
}

function closeModal() {
    document.getElementById('query-modal').classList.add('hidden');
}

document.getElementById('btn-search').addEventListener('click', async () => {
    const value = document.getElementById('query-input').value;
    if (!value) return alert('Digite o valor para consulta');

    const output = document.getElementById('json-output');
    output.innerText = 'Consultando...';

    try {
        const url = `/api/consultar?type=${currentQueryType}&value=${encodeURIComponent(value)}&token=${currentUser.token}`;
        const res = await fetch(url);
        const data = await res.json();
        output.innerText = JSON.stringify(data, null, 2);
    } catch (err) {
        output.innerText = 'Erro na consulta: ' + err.message;
    }
});

// Initial icon setup
lucide.createIcons();
