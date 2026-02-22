import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.API_PORT || 4000);
const HOST = process.env.API_HOST || '127.0.0.1';

const dataDir = path.resolve(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const state = loadState();

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'insurance-api' });
});

app.get('/api/bootstrap', (req, res) => {
  const user = resolveUser(req);
  res.json({
    user: user ? formatUser(user) : null,
    balance: user ? getBalance(user.id) : 0,
    tabs: ['home', 'learning', 'activities', 'insurance', 'profile'],
  });
});

app.post('/api/auth/send-code', (req, res) => {
  const mobile = String(req.body?.mobile || '').trim();
  if (!/^1[3-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({ code: 'INVALID_MOBILE', message: '请输入正确手机号' });
  }

  const today = dateOnly(new Date());
  const sentToday = state.smsCodes.filter((s) => s.mobile === mobile && s.createdAt.startsWith(today)).length;
  if (sentToday >= 5) {
    return res.status(429).json({ code: 'SMS_LIMIT_REACHED', message: '今日验证码次数已达上限' });
  }

  const code = process.env.DEV_SMS_CODE || '123456';
  state.smsCodes.push({
    id: nextId(state.smsCodes),
    mobile,
    code,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    used: false,
    createdAt: new Date().toISOString(),
  });
  persist();
  res.json({ ok: true, message: '验证码已发送', dev_code: process.env.NODE_ENV === 'production' ? undefined : code });
});

app.post('/api/auth/verify-basic', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const mobile = String(req.body?.mobile || '').trim();
  const code = String(req.body?.code || '').trim();

  if (!/^[\u4e00-\u9fa5·]{2,20}$/.test(name)) return res.status(400).json({ code: 'INVALID_NAME', message: '姓名格式不正确' });
  if (!/^1[3-9]\d{9}$/.test(mobile)) return res.status(400).json({ code: 'INVALID_MOBILE', message: '手机号格式不正确' });
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ code: 'INVALID_CODE', message: '验证码格式不正确' });

  const sms = [...state.smsCodes]
    .reverse()
    .find((s) => s.mobile === mobile && s.code === code && !s.used);
  if (!sms) return res.status(400).json({ code: 'CODE_NOT_FOUND', message: '验证码错误或已失效' });
  if (new Date(sms.expiresAt).getTime() < Date.now()) return res.status(400).json({ code: 'CODE_EXPIRED', message: '验证码已过期' });

  sms.used = true;
  let user = state.users.find((u) => u.mobile === mobile);
  if (!user) {
    user = {
      id: nextId(state.users),
      name,
      mobile,
      isVerifiedBasic: true,
      verifiedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.users.push(user);
    appendPoints(user.id, 'earn', 200, 'onboard', String(user.id), '新用户基础积分');
  } else {
    user.name = name;
    user.isVerifiedBasic = true;
    user.verifiedAt = new Date().toISOString();
  }

  const token = crypto.randomUUID();
  state.sessions.push({
    token,
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
  });
  persist();
  res.json({ token, user: formatUser(user) });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: formatUser(req.user), balance: getBalance(req.user.id) });
});

app.get('/api/activities', requireAuthOptional, (req, res) => {
  res.json({
    activities: state.activities.sort((a, b) => a.sortOrder - b.sortOrder),
    balance: req.user ? getBalance(req.user.id) : 0,
  });
});

app.post('/api/sign-in', requireAuth, (req, res) => {
  if (!req.user.isVerifiedBasic) {
    return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
  }

  const today = dateOnly(new Date());
  const exists = state.signIns.find((s) => s.userId === req.user.id && s.signDate === today);
  if (exists) return res.status(409).json({ code: 'ALREADY_SIGNED', message: '今日已签到' });

  state.signIns.push({
    id: nextId(state.signIns),
    userId: req.user.id,
    signDate: today,
    pointsAwarded: 10,
    createdAt: new Date().toISOString(),
  });
  appendPoints(req.user.id, 'earn', 10, 'daily_sign_in', today, '每日签到奖励');
  persist();
  res.json({ ok: true, reward: 10, balance: getBalance(req.user.id) });
});

app.get('/api/points/summary', requireAuth, (req, res) => {
  res.json({ balance: getBalance(req.user.id) });
});

app.get('/api/points/transactions', requireAuth, (req, res) => {
  const list = state.pointTransactions
    .filter((t) => t.userId === req.user.id)
    .sort((a, b) => b.id - a.id);
  res.json({ list });
});

app.get('/api/mall/items', requireAuthOptional, (_req, res) => {
  res.json({ items: state.mallItems.filter((i) => i.isActive) });
});

app.post('/api/mall/redeem', requireAuth, (req, res) => {
  if (!req.user.isVerifiedBasic) {
    return res.status(403).json({ code: 'NEED_BASIC_VERIFY', message: '请先完成基础身份确认' });
  }
  const itemId = Number(req.body?.itemId);
  const item = state.mallItems.find((i) => i.id === itemId && i.isActive);
  if (!item) return res.status(404).json({ code: 'ITEM_NOT_FOUND', message: '商品不存在' });
  if (item.stock <= 0) return res.status(409).json({ code: 'OUT_OF_STOCK', message: '库存不足' });
  const balance = getBalance(req.user.id);
  if (balance < item.pointsCost) return res.status(409).json({ code: 'INSUFFICIENT_POINTS', message: '积分不足' });

  item.stock -= 1;
  const redemption = {
    id: nextId(state.redemptions),
    userId: req.user.id,
    itemId: item.id,
    pointsCost: item.pointsCost,
    status: 'pending',
    writeoffToken: `EX${Date.now()}${Math.floor(Math.random() * 1000)}`,
    expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    writtenOffAt: null,
  };
  state.redemptions.push(redemption);
  appendPoints(req.user.id, 'consume', item.pointsCost, 'redeem', String(redemption.id), `兑换 ${item.name}`);
  persist();

  res.json({ ok: true, token: redemption.writeoffToken, balance: getBalance(req.user.id) });
});

app.get('/api/redemptions', requireAuth, (req, res) => {
  const list = state.redemptions
    .filter((r) => r.userId === req.user.id)
    .map((r) => ({ ...r, itemName: state.mallItems.find((i) => i.id === r.itemId)?.name || '' }))
    .sort((a, b) => b.id - a.id);
  res.json({ list });
});

app.post('/api/redemptions/:id/writeoff', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const token = String(req.body?.token || '').trim();
  const row = state.redemptions.find((r) => r.id === id && r.userId === req.user.id);
  if (!row) return res.status(404).json({ code: 'REDEMPTION_NOT_FOUND', message: '兑换记录不存在' });
  if (row.status === 'written_off') return res.status(409).json({ code: 'ALREADY_WRITTEN_OFF', message: '已核销' });
  if (token && token !== row.writeoffToken) return res.status(400).json({ code: 'INVALID_TOKEN', message: '核销码错误' });
  if (new Date(row.expiresAt).getTime() < Date.now()) return res.status(410).json({ code: 'TOKEN_EXPIRED', message: '核销已过期' });
  row.status = 'written_off';
  row.writtenOffAt = new Date().toISOString();
  persist();
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`insurance api listening on http://${HOST}:${PORT}`);
});

function requireAuth(req, res, next) {
  const user = resolveUser(req);
  if (!user) return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录' });
  req.user = user;
  next();
}

function requireAuthOptional(req, _res, next) {
  req.user = resolveUser(req);
  next();
}

function resolveUser(req) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const session = state.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) return null;
  return state.users.find((u) => u.id === session.userId) || null;
}

function getBalance(userId) {
  const txs = state.pointTransactions.filter((t) => t.userId === userId).sort((a, b) => b.id - a.id);
  return txs[0]?.balance || 0;
}

function appendPoints(userId, type, amount, source, sourceId, description) {
  const prev = getBalance(userId);
  const balance = type === 'earn' ? prev + amount : prev - amount;
  state.pointTransactions.push({
    id: nextId(state.pointTransactions),
    userId,
    type,
    amount,
    source,
    sourceId,
    balance,
    description,
    createdAt: new Date().toISOString(),
  });
}

function nextId(list) {
  if (!list.length) return 1;
  return Math.max(...list.map((x) => x.id)) + 1;
}

function dateOnly(d) {
  return d.toISOString().slice(0, 10);
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    mobile: user.mobile,
    is_verified_basic: user.isVerifiedBasic,
    verified_at: user.verifiedAt,
  };
}

function loadState() {
  if (fs.existsSync(dbPath)) {
    const raw = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(raw);
  }

  const initial = {
    users: [],
    smsCodes: [],
    sessions: [],
    activities: [
      { id: 1, title: '连续签到7天领鸡蛋', category: 'sign', rewardPoints: 10, sortOrder: 1 },
      { id: 2, title: '保险知识王者赛', category: 'competition', rewardPoints: 50, sortOrder: 2 },
      { id: 3, title: '完善保障信息', category: 'task', rewardPoints: 100, sortOrder: 3 },
      { id: 4, title: '推荐好友加入', category: 'invite', rewardPoints: 500, sortOrder: 4 },
    ],
    signIns: [],
    pointTransactions: [],
    mallItems: [
      { id: 1, name: '智能低糖电饭煲', pointsCost: 1200, stock: 50, isActive: true },
      { id: 2, name: '家庭体检套餐', pointsCost: 800, stock: 80, isActive: true },
      { id: 3, name: '健康管理咨询券', pointsCost: 300, stock: 999, isActive: true },
    ],
    redemptions: [],
  };
  fs.writeFileSync(dbPath, JSON.stringify(initial, null, 2));
  return initial;
}

function persist() {
  fs.writeFileSync(dbPath, JSON.stringify(state, null, 2));
}
