import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './lib/db.js';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || '0limits-ultra-secret-key-2024';

// Security Middleware - PROTECTION RIGID
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});

// Middleware: Verify JWT & Expiration
const authenticate = async (req, res, next) => {
    if (!db.data) await db.read();
    
    // Auth can be via Header (API) or Cookie/Header (Dashboard)
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : req.query.token;

    if (!token) return res.status(401).json({ error: 'Token ausente.' });

    // Check if it's an API Token (nanoid) or Session Token (JWT)
    let user = db.data.users.find(u => u.token === token);
    
    if (!user) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            user = db.data.users.find(u => u.username === decoded.username);
        } catch (err) {
            return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
        }
    }

    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });

    // Check Expiration
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Sua licença expirou. Entre em contato com o administrador.' });
    }

    req.user = user;
    next();
};

const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    next();
};

// --- ROUTES ---

// 1. Health/Auth Check
app.get('/auth/me', authenticate, (req, res) => {
    const { password, ...safeUser } = req.user;
    res.json({ success: true, user: safeUser });
});

// 2. Proxy API
app.get('/api/consultar', authenticate, async (req, res) => {
  const { type, value } = req.query;

  const endpoints = {
    cpf: 'busca_cpf.php?cpf=',
    nome: 'busca_nome.php?nome=',
    mae: 'busca_mae.php?mae=',
    titulo: 'busca_titulo.php?titulo=',
    pai: 'busca_pai.php?pai=',
    rg: 'busca_rg.php?rg='
  };

  const endpoint = endpoints[type];
  if (!endpoint) return res.status(400).json({ error: 'Tipo de consulta inválido.' });

  try {
    const targetUrl = `http://apisbrasilpro.site/api/${endpoint}${encodeURIComponent(value)}`;
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: { 'User-Agent': '0Limits-Gateway/2.0' }
    });

    // Limpeza Profunda Recursiva (Remove créditos em qualquer nível)
    const cleanResponse = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        const keysToRemove = ['criado_por', 'criado_pelo', 'creditos', 'site', 'telegram', 'vendedor', 'dev', 'api'];
        
        if (Array.isArray(obj)) return obj.map(cleanResponse);

        return Object.fromEntries(
            Object.entries(obj)
                .filter(([key]) => !keysToRemove.some(k => key.toLowerCase().includes(k)))
                .map(([key, value]) => [key, cleanResponse(value)])
        );
    };

    const responseData = cleanResponse(response.data);

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: 'Erro na API destino.' });
  }
});

// 3. User Logs
app.get('/api/logs', authenticate, (req, res) => {
    const logs = req.user.role === 'admin' 
        ? db.data.logs 
        : db.data.logs.filter(l => l.user === req.user.username);
    res.json(logs);
});

// 4. Admin Management
app.get('/api/admin/users', authenticate, adminOnly, (req, res) => {
    const users = db.data.users.map(({ password, ...u }) => u);
    res.json(users);
});

app.post('/api/admin/users/extend', authenticate, adminOnly, async (req, res) => {
    const { username, days } = req.body;
    const target = db.data.users.find(u => u.username === username);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    
    const currentExp = new Date(target.expiresAt || new Date());
    currentExp.setDate(currentExp.getDate() + parseInt(days));
    target.expiresAt = currentExp.toISOString();
    
    await db.write();
    res.json({ success: true, expiresAt: target.expiresAt });
});

app.delete('/api/admin/users/:username', authenticate, adminOnly, async (req, res) => {
    if (req.params.username === 'admin') return res.status(400).json({ error: 'Não é possível deletar o admin principal.' });
    db.data.users = db.data.users.filter(u => u.username !== req.params.username);
    await db.write();
    res.json({ success: true });
});

// 5. Auth Logic
app.post('/auth/login', async (req, res) => {
  if (!db.data) await db.read();
  const { username, password } = req.body;
  const user = db.data.users.find(u => u.username === username);
  
  if (user && await bcrypt.compare(password, user.password)) {
    // Check expiration during login
    if (user.expiresAt && new Date(user.expiresAt) < new Date()) {
        return res.status(403).json({ error: 'Sua conta expirou.' });
    }

    const sessionToken = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token: sessionToken, user: { username: user.username, role: user.role, token: user.token, expiresAt: user.expiresAt } });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!db.data) await db.read();
    if (db.data.users.find(u => u.username === username)) return res.status(400).json({ error: 'Usuário já existe.' });

    const exp = new Date();
    exp.setDate(exp.getDate() + 7); // Default 7 days trial

    const newUser = {
        username,
        password: await bcrypt.hash(password, 10),
        role: 'user',
        token: nanoid(32),
        expiresAt: exp.toISOString()
    };
    db.data.users.push(newUser);
    await db.write();
    res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`[0Limits] Secure Server running at http://localhost:${PORT}`);
});
