// ============================================================
//  销售作战图 · 零依赖后端中转（Node 内置模块，兼容 QW Pages 动态运行时）
// ------------------------------------------------------------
//  静态服务：项目根目录（index.html / data.js / vendor/）
//  API：
//    GET  /api/health     健康检查 + 存储类型
//    GET  /api/customers  读取全部客户
//    POST /api/customers  保存客户（添加客户表单）
//    GET  /api/tunjie     探迹挖掘：拉线索 → 批量写入 Neon → 返回
//    GET  /api/enrich     探迹/天眼查/爱企查 自动回填
//  存储优先级：平台注入 Supabase(env) → Neon(连接串) → 内存
//  密钥规则：探迹密钥 / DB 连接串仅存本服务环境变量或 neon-config.js，前端零密钥
// ============================================================
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || '0.0.0.0';

// ---------- 存储适配 ----------
let NEON_URL = process.env.DATABASE_URL || '';
if (!NEON_URL) {
  try { NEON_URL = require('./neon-config.js').url || ''; } catch (e) { /* 可选 */ }
}
const SUPA_URL = process.env.SUPABASE_URL || '';
const SUPA_KEY = process.env.SUPABASE_ANON_KEY || '';

function neonFetch(query, params) {
  const m = NEON_URL.match(/@([^/]+)\//);
  const host = m ? m[1] : '';
  return fetch('https://' + host + '/sql', {
    method: 'POST',
    headers: { 'Neon-Connection-String': NEON_URL, 'Content-Type': 'application/json' },
    body: JSON.stringify(params ? { query, params } : { query })
  }).then(r => r.json());
}
function supaFetch(pathname, opts) {
  return fetch(SUPA_URL + '/rest/v1/' + pathname, Object.assign({
    headers: {
      apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json', Prefer: 'return=representation'
    }
  }, opts)).then(r => r.json());
}
const storageType = () => (SUPA_URL && SUPA_KEY ? 'supabase' : (NEON_URL ? 'neon' : 'memory'));
const memory = [];

const DB_COLS = ['name', 'lat', 'lng', 'region', 'district', 'industry', 'website', 'address',
  'contact', 'phone', 'other_contacts', 'contacted', 'pc_count', 'rd_count', 'access_mode',
  'monthly_spend', 'models', 'tools', 'registered', 'dynamics', 'source', 'note'];
const CAMEL = { other_contacts: 'otherContacts', pc_count: 'pcCount', rd_count: 'rdCount', access_mode: 'accessMode', monthly_spend: 'monthlySpend' };
function toCamel(row) {
  const o = {};
  Object.keys(row).forEach(k => { o[CAMEL[k] || k] = row[k]; });
  return o;
}
function toRow(c) {
  return DB_COLS.map(col => {
    const key = CAMEL[col] || col;
    let v = c[key];
    if (col === 'lat' || col === 'lng' || col === 'pc_count' || col === 'rd_count') v = (typeof v === 'number' && !isNaN(v)) ? v : null;
    if (col === 'monthly_spend') v = (typeof v === 'number' && !isNaN(v)) ? v : 0;
    return v == null ? '' : v;
  });
}

async function listCustomers() {
  if (storageType() === 'supabase') return (await supaFetch('leads?select=*&order=created_at.desc&limit=2000')).map(toCamel);
  if (storageType() === 'neon') return (await neonFetch('SELECT * FROM leads ORDER BY created_at DESC LIMIT 2000')).rows.map(toCamel);
  return memory.slice();
}
async function insertCustomer(c) {
  if (storageType() === 'supabase') {
    const row = {}; DB_COLS.forEach((col, i) => { row[col] = toRow(c)[i]; });
    return await supaFetch('leads', { method: 'POST', body: JSON.stringify(row) });
  }
  if (storageType() === 'neon') {
    const params = toRow(c);
    const ph = DB_COLS.map((_, i) => '$' + (i + 1)).join(',');
    return await neonFetch('INSERT INTO leads (' + DB_COLS.join(',') + ') VALUES (' + ph + ') ON CONFLICT (name, region) DO NOTHING', params);
  }
  memory.push(c); return {};
}
async function bulkInsert(rows) {
  if (!rows.length) return 0;
  if (storageType() === 'supabase') {
    const arr = rows.map(c => { const row = {}; DB_COLS.forEach((col, i) => { row[col] = toRow(c)[i]; }); return row; });
    const res = await supaFetch('leads', { method: 'POST', body: JSON.stringify(arr) });
    return Array.isArray(res) ? res.length : rows.length;
  }
  if (storageType() === 'neon') {
    const params = [];
    const groups = rows.map(c => {
      const off = params.length;
      const r = toRow(c); r.forEach(v => params.push(v));
      return '(' + r.map((_, j) => '$' + (off + j + 1)).join(',') + ')';
    });
    const res = await neonFetch('INSERT INTO leads (' + DB_COLS.join(',') + ') VALUES ' + groups.join(',') + ' ON CONFLICT (name, region) DO NOTHING RETURNING id', params);
    return Array.isArray(res.rows) ? res.rows.length : 0;
  }
  rows.forEach(r => memory.push(r)); return rows.length;
}

// ---------- 认证：scrypt 哈希 + token 会话（用户存 Neon/Supabase/内存） ----------
const crypto = require('crypto');
const sessions = new Map(); // token -> {username, role}
const memUsers = [];
function hashPass(p, salt) { return crypto.scryptSync(String(p), String(salt), 64).toString('hex'); }
function newSalt() { return crypto.randomBytes(8).toString('hex'); }
function newToken() { return crypto.randomBytes(24).toString('hex'); }
function authUser(req) {
  const t = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return t && sessions.has(t) ? sessions.get(t) : null;
}
const LEADS_DDL = 'CREATE TABLE IF NOT EXISTS leads (id bigint generated always as identity primary key, name text not null, lat double precision, lng double precision, region text, district text, industry text, status text, priority text, footprint text, visits jsonb default \'[]\', dynamics text default \'\', source text default \'探迹\', address text default \'\', phone text default \'\', contact text default \'\', note text default \'\', key_account text default \'否\', website text default \'\', other_contacts text default \'\', contacted text default \'未建联\', pc_count integer, rd_count integer, access_mode text default \'\', monthly_spend double precision, models text default \'\', tools text default \'\', registered text default \'否\', created_at timestamptz default now(), unique (name, region))';
const USERS_DDL = 'CREATE TABLE IF NOT EXISTS users (id bigint generated always as identity primary key, username text not null unique, pass_hash text not null, salt text not null, role text default \'user\', created_at timestamptz default now())';
async function ensureSchema() {
  if (storageType() !== 'neon') return;
  try {
    await neonFetch(USERS_DDL);
    await neonFetch(LEADS_DDL);
    await neonFetch('CREATE INDEX IF NOT EXISTS idx_leads_region ON leads (region)');
    await neonFetch('CREATE INDEX IF NOT EXISTS idx_leads_district ON leads (district)');
    await neonFetch('CREATE INDEX IF NOT EXISTS idx_leads_industry ON leads (industry)');
    console.log('[relay] schema ensured (users + leads)');
  } catch (e) { console.warn('[relay] schema init failed:', e.message); }
}
async function usersAll() {
  if (storageType() === 'supabase') return await supaFetch('users?select=username,role&order=created_at');
  if (storageType() === 'neon') return (await neonFetch('SELECT username, role FROM users ORDER BY created_at')).rows;
  return memUsers.map(u => ({ username: u.username, role: u.role }));
}
async function userByName(name) {
  if (storageType() === 'supabase') { const r = await supaFetch('users?select=*&username=eq.' + encodeURIComponent(name)); return r[0] || null; }
  if (storageType() === 'neon') { const r = await neonFetch('SELECT * FROM users WHERE username=$1', [name]); return r.rows[0] || null; }
  return memUsers.find(u => u.username === name) || null;
}
async function userInsert(u) {
  if (storageType() === 'supabase') return await supaFetch('users', { method: 'POST', body: JSON.stringify(u) });
  if (storageType() === 'neon') return await neonFetch('INSERT INTO users (username, pass_hash, salt, role) VALUES ($1,$2,$3,$4)', [u.username, u.pass_hash, u.salt, u.role]);
  memUsers.push(u); return {};
}
async function userSetRole(name, role) {
  if (storageType() === 'supabase') return await supaFetch('users?username=eq.' + encodeURIComponent(name), { method: 'PATCH', body: JSON.stringify({ role }) });
  if (storageType() === 'neon') return await neonFetch('UPDATE users SET role=$1 WHERE username=$2', [role, name]);
  const u = memUsers.find(v => v.username === name); if (u) u.role = role; return {};
}
async function userDelete(name) {
  if (storageType() === 'supabase') return await supaFetch('users?username=eq.' + encodeURIComponent(name), { method: 'DELETE' });
  if (storageType() === 'neon') return await neonFetch('DELETE FROM users WHERE username=$1', [name]);
  const i = memUsers.findIndex(v => v.username === name); if (i >= 0) memUsers.splice(i, 1); return {};
}
async function deleteLead(id) {
  if (storageType() === 'supabase') return await supaFetch('leads?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
  if (storageType() === 'neon') return await neonFetch('DELETE FROM leads WHERE id=$1', [id]);
  const i = memory.findIndex(v => String(v.id) === String(id)); if (i >= 0) memory.splice(i, 1); return {};
}

// ---------- 探迹 / 回填（密钥仅存本服务） ----------
const CITY_CENTER = {
  '武汉': [30.593, 114.305], '黄石': [30.2, 115.038], '十堰': [32.629, 110.787], '宜昌': [30.692, 111.286],
  '襄阳': [32.009, 112.122], '鄂州': [30.391, 114.894], '荆门': [31.035, 112.217], '孝感': [30.926, 113.916],
  '荆州': [30.335, 112.239], '黄冈': [30.453, 114.872], '咸宁': [29.841, 114.322], '随州': [31.69, 113.382],
  '恩施州': [30.272, 109.479], '仙桃': [30.362, 113.442], '潜江': [30.421, 112.896], '天门': [30.663, 113.166], '神农架': [31.744, 110.675]
};
const DISTRICTS = {
  '武汉': ['江岸', '江汉', '硚口', '汉阳', '武昌', '青山', '洪山', '东西湖', '汉南', '蔡甸', '江夏', '黄陂', '新洲'],
  '黄石': ['黄石港区', '西塞山', '下陆', '铁山', '大冶', '阳新'], '十堰': ['茅箭', '张湾', '郧阳', '房县', '竹溪', '竹山', '丹江口', '郧西'],
  '宜昌': ['西陵', '伍家岗', '点军', '猇亭', '夷陵', '远安', '兴山', '秭归', '长阳', '五峰', '宜都', '枝江', '当阳'],
  '襄阳': ['襄城', '樊城', '襄州', '南漳', '谷城', '保康', '老河口', '枣阳', '宜城'], '鄂州': ['鄂城区', '华容', '梁子湖'],
  '荆门': ['东宝', '掇刀', '京山', '沙洋', '钟祥'], '孝感': ['孝南', '应城', '安陆', '汉川', '孝昌', '大悟', '云梦'],
  '荆州': ['沙市', '荆州区', '公安', '监利', '江陵', '石首', '洪湖', '松滋'], '黄冈': ['黄州', '团风', '红安', '罗田', '英山', '浠水', '蕲春', '黄梅', '麻城', '武穴'],
  '咸宁': ['咸安', '嘉鱼', '通城', '崇阳', '通山', '赤壁'], '随州': ['曾都', '随县', '广水'],
  '恩施州': ['恩施市', '利川', '建始', '巴东', '宣恩', '咸丰', '来凤', '鹤峰']
};
function hash(s) { let h = 0; s = String(s || ''); for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0; return h; }

async function fetchTunjieLeads(region, track) {
  if (process.env.TUNJIE_APP_KEY && process.env.TUNJIE_APP_SECRET) {
    // TODO 真实接入：按探迹开放平台文档以 region+track 检索企业（密钥仅存本服务环境变量），
    // 再经天眼查/爱企查补全 dynamics 后返回 lead 结构。
    throw new Error('已配置探迹密钥：请按官方文档实现真实调用');
  }
  const n = 3 + Math.floor(Math.random() * 3);
  const center = CITY_CENTER[region] || [30.95, 112.35];
  const dss = DISTRICTS[region] || [];
  const leads = [];
  for (let i = 0; i < n; i++) {
    leads.push({
      name: '[模拟]' + region + track + '企业' + (i + 1),
      keyAccount: i === 0 ? '是' : '否', industry: track, website: '',
      address: region + 'xx路' + (i + 1) + '号', contact: ['王', '李', '张'][i % 3] + '总', phone: '',
      otherContacts: '', contacted: '未建联', pcCount: 30 + i * 20, rdCount: 5 + i * 5,
      accessMode: '未定', monthlySpend: 0, models: '', tools: '', registered: '否',
      region, district: dss.length ? dss[i % dss.length] : '',
      lat: +(center[0] + (Math.random() - 0.5) * 0.3).toFixed(4),
      lng: +(center[1] + (Math.random() - 0.5) * 0.3).toFixed(4),
      dynamics: '', source: '探迹(模拟)', note: '模拟线索：探迹密钥未配置'
    });
  }
  return leads;
}
function enrichByName(name) {
  const h = hash(name);
  const surnames = ['王', '李', '张', '刘', '陈'];
  const models = ['通义', 'DeepSeek', 'GPT', 'GLM', '文心'];
  const tools = ['Cursor', 'Dify', 'Coze', 'Copilot'];
  const region = '武汉';
  const dss = DISTRICTS[region] || [];
  const pc = 20 + (h % 280);
  return {
    website: 'https://www.' + ['hb', 'wh', 'yc', 'xy'][h % 4] + ((h % 998) + 1) + '.com',
    address: region + (dss[h % dss.length] || '') + 'xx路' + ((h % 99) + 1) + '号',
    contact: surnames[h % 5] + '总',
    phone: '138' + String(h % 100000000).padStart(8, '0'),
    otherContacts: '', pcCount: pc,
    rdCount: Math.max(2, Math.round(pc * (0.15 + (h % 30) / 100))),
    accessMode: ['API', 'SDK', '私有化部署', '云平台', '未定'][h % 5],
    monthlySpend: h % 12,
    models: models[h % 5] + '/' + models[(h + 1) % 5],
    tools: tools[h % 4],
    registered: h % 2 ? '是' : '否', contacted: '未建联',
    region, district: dss[h % dss.length] || '',
    lat: +((CITY_CENTER[region][0]) + ((h % 100) - 50) / 400).toFixed(4),
    lng: +((CITY_CENTER[region][1]) + (((h >> 3) % 100) - 50) / 400).toFixed(4),
    dynamics: '探迹/天眼查模拟回填：经营状态正常，近期无重大变更'
  };
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json' };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function serveStatic(res, urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}
function readBody(req) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', d => { s += d; });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch (e) { resolve({}); } });
  });
}

http.createServer(async (req, res) => {
  const u = req.url || '/';
  try {
    if (u.startsWith('/api/health')) return json(res, 200, { ok: true, storage: storageType(), tunjie: !!(process.env.TUNJIE_APP_KEY && process.env.TUNJIE_APP_SECRET) });

    // ---------- 认证 ----------
    if (u.startsWith('/api/auth/')) {
      const body = (req.method === 'POST') ? await readBody(req) : null;
      if (u.startsWith('/api/auth/register')) {
        const name = String(body.username || '').trim(), pass = String(body.password || '');
        if (name.length < 2) return json(res, 400, { error: '用户名至少 2 个字符' });
        if (pass.length < 6) return json(res, 400, { error: '密码至少 6 位' });
        if (await userByName(name)) return json(res, 400, { error: '用户名已存在' });
        const role = (await usersAll()).length === 0 ? 'admin' : 'user'; // 首个用户=管理员
        const salt = newSalt();
        await userInsert({ username: name, pass_hash: hashPass(pass, salt), salt, role });
        const token = newToken(); sessions.set(token, { username: name, role });
        return json(res, 200, { token, user: { username: name, role } });
      }
      if (u.startsWith('/api/auth/login')) {
        const name = String(body.username || '').trim(), pass = String(body.password || '');
        const usr = await userByName(name);
        if (!usr || usr.pass_hash !== hashPass(pass, usr.salt)) return json(res, 401, { error: '用户名或密码错误' });
        const token = newToken(); sessions.set(token, { username: usr.username, role: usr.role });
        return json(res, 200, { token, user: { username: usr.username, role: usr.role } });
      }
      const au = authUser(req);
      if (u.startsWith('/api/auth/me')) return au ? json(res, 200, { user: au }) : json(res, 401, { error: '未登录' });
      if (!au) return json(res, 401, { error: '未登录' });
      if (u.startsWith('/api/auth/users')) {
        if (au.role !== 'admin') return json(res, 403, { error: '需管理员权限' });
        return json(res, 200, await usersAll());
      }
      if (u.startsWith('/api/auth/role')) {
        if (au.role !== 'admin') return json(res, 403, { error: '需管理员权限' });
        const target = String(body.username || ''), role = body.role === 'admin' ? 'admin' : 'user';
        if (target === au.username) return json(res, 400, { error: '不能修改自己的角色' });
        await userSetRole(target, role);
        return json(res, 200, { ok: true });
      }
      if (u.startsWith('/api/auth/delete')) {
        if (au.role !== 'admin') return json(res, 403, { error: '需管理员权限' });
        const target = String(body.username || '');
        if (target === au.username) return json(res, 400, { error: '不能删除自己' });
        await userDelete(target);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: 'not found' });
    }

    // ---------- 业务 API（登录/权限校验） ----------
    const au = authUser(req);
    if (u.startsWith('/api/customers') && req.method === 'GET') {
      if (!au) return json(res, 401, { error: '需登录' });
      return json(res, 200, await listCustomers());
    }
    if (u.startsWith('/api/customers') && req.method === 'POST') {
      if (!au) return json(res, 401, { error: '需登录' });
      const c = await readBody(req);
      if (!c.name) return json(res, 400, { error: 'name required' });
      await insertCustomer(c);
      return json(res, 200, { ok: true, storage: storageType() });
    }
    if (u.startsWith('/api/customers') && req.method === 'DELETE') {
      if (!au) return json(res, 401, { error: '需登录' });
      if (au.role !== 'admin') return json(res, 403, { error: '需管理员权限' });
      const id = new URL(u, 'http://x').searchParams.get('id');
      await deleteLead(id);
      return json(res, 200, { ok: true });
    }
    if (u.startsWith('/api/tunjie')) {
      if (!au) return json(res, 401, { error: '需登录' });
      if (au.role !== 'admin') return json(res, 403, { error: '需管理员权限' });
      const q = new URL(u, 'http://x').searchParams;
      const region = q.get('region') || '', track = q.get('track') || '';
      if (!region || !track) return json(res, 400, { error: 'region 与 track 为必填双维度' });
      const leads = await fetchTunjieLeads(region, track);
      const written = await bulkInsert(leads);
      return json(res, 200, { region, track, leads, written, storage: storageType() });
    }
    if (u.startsWith('/api/enrich')) {
      if (!au) return json(res, 401, { error: '需登录' });
      const q = new URL(u, 'http://x').searchParams;
      return json(res, 200, enrichByName(q.get('name') || ''));
    }
    if (req.method === 'GET') return serveStatic(res, u);
    json(res, 405, { error: 'method not allowed' });
  } catch (e) {
    json(res, 500, { error: String((e && e.message) || e) });
  }
}).listen(PORT, HOST, () => {
  console.log('[relay] http://' + HOST + ':' + PORT + ' storage=' + storageType());
  ensureSchema();
});
