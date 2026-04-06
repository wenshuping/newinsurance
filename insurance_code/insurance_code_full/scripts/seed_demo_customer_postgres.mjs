import {
  appendPoints,
  closeState,
  getState,
  initializeState,
  nextId,
  persistState,
} from '../server/skeleton-c-v1/common/state.mjs';

function nowIso() {
  return new Date().toISOString();
}

function ensureAgent(state) {
  if (!Array.isArray(state.agents)) state.agents = [];
  let agent = state.agents.find((x) => Number(x.id) === 8202);
  if (!agent) {
    agent = {
      id: 8202,
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      name: '租户A业务员1',
      status: 'active',
      role: 'agent',
      account: 'tenanta_agent1',
      email: 'tenanta_agent1@demo.local',
      mobile: '13810000002',
      password: '123456',
      initialPassword: '123456',
      createdAt: nowIso(),
    };
    state.agents.push(agent);
  }
  return agent;
}

function ensureCustomer(state, ownerAgentId) {
  if (!Array.isArray(state.users)) state.users = [];
  let user = state.users.find((x) => String(x.mobile || '') === '18616135811');
  if (!user) {
    user = {
      id: nextId(state.users),
      name: '哈哈',
      mobile: '18616135811',
      isVerifiedBasic: true,
      verifiedAt: nowIso(),
      tenantId: 2,
      orgId: 2,
      teamId: 2,
      ownerUserId: ownerAgentId,
      createdAt: nowIso(),
    };
    state.users.push(user);
  } else {
    user.name = user.name || '哈哈';
    user.isVerifiedBasic = true;
    user.verifiedAt = user.verifiedAt || nowIso();
    user.tenantId = 2;
    user.orgId = 2;
    user.teamId = 2;
    user.ownerUserId = ownerAgentId;
  }
  return user;
}

function ensureMallAndActivities(state, createdBy) {
  if (!Array.isArray(state.mallItems)) state.mallItems = [];
  if (!Array.isArray(state.pProducts)) state.pProducts = [];
  if (!Array.isArray(state.activities)) state.activities = [];
  if (!Array.isArray(state.pActivities)) state.pActivities = [];
  if (!Array.isArray(state.learningCourses)) state.learningCourses = [];

  const t = nowIso();

  const products = [
    { name: '智能低糖电饭煲', pointsCost: 99, stock: 50, sortOrder: 1 },
    { name: '家庭体检套餐', pointsCost: 79, stock: 80, sortOrder: 2 },
    { name: '健康管理咨询券', pointsCost: 59, stock: 999, sortOrder: 3 },
  ];
  for (const p of products) {
    let item = state.mallItems.find((x) => String(x.name) === p.name && Number(x.tenantId || 2) === 2);
    if (!item) {
      item = { id: nextId(state.mallItems), tenantId: 2, name: p.name, pointsCost: p.pointsCost, stock: p.stock, isActive: true, sortOrder: p.sortOrder, createdBy, createdAt: t };
      state.mallItems.push(item);
    } else {
      item.tenantId = 2;
      item.pointsCost = p.pointsCost;
      item.stock = p.stock;
      item.isActive = true;
      item.sortOrder = p.sortOrder;
      item.createdBy = createdBy;
    }

    let prod = state.pProducts.find((x) => String(x.name) === p.name && Number(x.tenantId || 2) === 2);
    if (!prod) {
      prod = {
        id: nextId(state.pProducts),
        tenantId: 2,
        name: p.name,
        description: `${p.name} 演示商品`,
        pointsCost: p.pointsCost,
        stock: p.stock,
        status: 'active',
        shelfStatus: 'on',
        sortOrder: p.sortOrder,
        createdBy,
        createdAt: t,
        media: [],
      };
      state.pProducts.push(prod);
    } else {
      prod.tenantId = 2;
      prod.pointsCost = p.pointsCost;
      prod.stock = p.stock;
      prod.status = 'active';
      prod.shelfStatus = 'on';
      prod.sortOrder = p.sortOrder;
      prod.createdBy = createdBy;
    }
  }

  const activities = [
    { title: '连续签到7天领鸡蛋', category: 'sign', rewardPoints: 10, sortOrder: 1 },
    { title: '完善保障信息', category: 'task', rewardPoints: 100, sortOrder: 2 },
    { title: '推荐好友加入', category: 'invite', rewardPoints: 500, sortOrder: 3 },
  ];
  for (const a of activities) {
    let row = state.pActivities.find((x) => String(x.title) === a.title && Number(x.tenantId || 2) === 2);
    if (!row) {
      row = {
        id: nextId(state.pActivities),
        tenantId: 2,
        title: a.title,
        category: a.category,
        rewardPoints: a.rewardPoints,
        status: 'published',
        sortOrder: a.sortOrder,
        createdBy,
        createdAt: t,
        sourceDomain: 'activity',
        media: [],
      };
      state.pActivities.push(row);
    } else {
      row.tenantId = 2;
      row.status = 'published';
      row.createdBy = createdBy;
      row.sortOrder = a.sortOrder;
      row.rewardPoints = a.rewardPoints;
    }

    if (!state.activities.some((x) => String(x.title) === a.title)) {
      state.activities.push({
        id: nextId(state.activities),
        title: a.title,
        category: a.category,
        rewardPoints: a.rewardPoints,
        sortOrder: a.sortOrder,
        participants: 0,
      });
    }
  }

  const courses = [
    { title: '保险课堂-家庭保障入门', type: 'article', category: '保险课堂', points: 20 },
    { title: '趣味游戏-风险识别挑战', type: 'comic', category: '趣味游戏', points: 10 },
    { title: '实用工具-理赔资料清单', type: 'article', category: '实用工具', points: 15 },
  ];
  for (const c of courses) {
    let row = state.learningCourses.find((x) => String(x.title) === c.title && Number(x.tenantId || 2) === 2);
    if (!row) {
      row = {
        id: nextId(state.learningCourses),
        tenantId: 2,
        title: c.title,
        desc: `${c.title} 演示内容`,
        type: c.type,
        contentType: c.type,
        category: c.category,
        status: 'published',
        points: c.points,
        rewardPoints: c.points,
        content: `${c.title} 内容`,
        createdBy,
        createdAt: t,
      };
      state.learningCourses.push(row);
    } else {
      row.tenantId = 2;
      row.status = 'published';
      row.points = c.points;
      row.rewardPoints = c.points;
      row.createdBy = createdBy;
    }
  }
}

(async () => {
  await initializeState();
  const state = getState();

  const agent = ensureAgent(state);
  const customer = ensureCustomer(state, Number(agent.id));
  ensureMallAndActivities(state, Number(agent.id));

  const balanceNow = Number(
    Array.isArray(state.pointAccounts)
      ? (state.pointAccounts.find((x) => Number(x.userId) === Number(customer.id))?.balance ?? 0)
      : 0,
  );
  const target = 3000;
  if (balanceNow < target) {
    appendPoints(Number(customer.id), 'earn', target - balanceNow, 'manual_seed', 'seed_demo_customer_postgres', '初始化测试积分');
  }

  persistState();
  await closeState();

  console.log(
    JSON.stringify(
      {
        ok: true,
        customer: { id: customer.id, name: customer.name, mobile: customer.mobile, tenantId: customer.tenantId, ownerUserId: customer.ownerUserId },
        targetBalance: 3000,
      },
      null,
      2,
    ),
  );
})();
