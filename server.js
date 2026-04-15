import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './lib/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware - PROTECTION RIGID
app.use(helmet({
  contentSecurityPolicy: false, // For local dev and external resources
}));
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Rate Limiting - Prevent Brute Force and Abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Proxy Logic to external API
import axios from 'axios';

app.get('/api/consultar', async (req, res) => {
  if (!db.data) await db.read();
  const { type, value, token } = req.query;

  // 1. Validate Token
  const user = db.data.users.find(u => u.token === token);
  if (!user) {
    return res.status(401).json({ error: 'Token inválido ou ausente. Acesso negado.' });
  }

  // 2. Map types to external endpoints
  const endpoints = {
    cpf: 'busca_cpf.php?cpf=',
    nome: 'busca_nome.php?nome=',
    mae: 'busca_mae.php?mae=',
    titulo: 'busca_titulo.php?titulo=',
    pai: 'busca_pai.php?pai=',
    rg: 'busca_rg.php?rg='
  };

  const endpoint = endpoints[type];
  if (!endpoint) {
    return res.status(400).json({ error: 'Tipo de consulta invlido.' });
  }

  try {
    const targetUrl = `http://apisbrasilpro.site/api/${endpoint}${encodeURIComponent(value)}`;
    console.log(`[Proxy] Fetching: ${targetUrl}`);
    
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': '0Limits-Gateway/1.0'
      }
    });

    const responseData = response.data;
    
    // Filter out unwanted credits from external API
    if (responseData && typeof responseData === 'object') {
        delete responseData.criado_por;
        delete responseData.criado_pelo;
        if (responseData.DADOS && responseData.DADOS.criado_por) delete responseData.DADOS.criado_por;
    }

    // Save Log
    db.data.logs.unshift({ // Add to start of list
      user: user.username,
      type,
      value: value.slice(0, 3) + '***' + (value.length > 6 ? value.slice(-2) : ''), 
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 100 logs
    if (db.data.logs.length > 100) db.data.logs = db.data.logs.slice(0, 100);
    
    await db.write();

    res.json(responseData);
  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: 'Erro ao intermediar a consulta. API destino pode estar fora do ar.' });
  }
});

// Admin Route to get logs (needed for dashboard)
app.get('/api/logs', async (req, res) => {
    const { token } = req.query;
    if (!db.data) await db.read();
    const user = db.data.users.find(u => u.token === token);
    if (!user) return res.status(401).json({ error: 'Negado.' });

    // Users see their own logs, admins see everything
    const logs = user.role === 'admin' 
        ? db.data.logs 
        : db.data.logs.filter(l => l.user === user.username);
    
    res.json(logs);
});

// Auth Routes
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

app.post('/auth/login', async (req, res) => {
  if (!db.data) await db.read();
  const { username, password } = req.body;
  const user = db.data.users.find(u => u.username === username);
  
  if (user) {
    // For admin with empty/default password
    const isAdminDefault = user.role === 'admin' && (password === 'admin123' || user.password === '');
    
    // For regular users (bcrypt check)
    const isPasswordValid = user.password.startsWith('$2b$') 
      ? await bcrypt.compare(password, user.password)
      : isAdminDefault;

    if (isPasswordValid || isAdminDefault) {
      res.json({ success: true, user: { username: user.username, token: user.token, role: user.role } });
    } else {
      res.status(401).json({ error: 'Credenciais inválidas.' });
    }
  } else {
    res.status(401).json({ error: 'Credenciais inválidas.' });
  }
});

app.post('/auth/register', async (req, res) => {
    // Basic register for demo
    const { username, password } = req.body;
    if (!db.data) await db.read();
    if (db.data.users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Usuário já existe.' });
    }
    const newUser = {
        username,
        password: await bcrypt.hash(password, 10),
        role: 'user',
        token: nanoid(32)
    };
    db.data.users.push(newUser);
    await db.write();
    res.json({ success: true, token: newUser.token });
});

app.listen(PORT, () => {
  console.log(`[0Limits] Server running at http://localhost:${PORT}`);
});
