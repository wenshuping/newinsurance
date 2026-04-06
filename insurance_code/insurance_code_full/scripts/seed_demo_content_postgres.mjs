import { closeState, getState, initializeState, nextId, persistState } from '../server/skeleton-c-v1/common/state.mjs';

function nowIso() {
  return new Date().toISOString();
}

(async () => {
  await initializeState();
  const state = getState();

  if (!Array.isArray(state.activities)) state.activities = [];
  if (!Array.isArray(state.pActivities)) state.pActivities = [];
  if (!Array.isArray(state.mallItems)) state.mallItems = [];
  if (!Array.isArray(state.pProducts)) state.pProducts = [];
  if (!Array.isArray(state.learningCourses)) state.learningCourses = [];

  const t = nowIso();

  const ensureActivity = (title, category, rewardPoints, sortOrder) => {
    if (state.activities.some((x) => String(x.title) === title) || state.pActivities.some((x) => String(x.title) === title)) return;
    const id = Math.max(nextId(state.activities), nextId(state.pActivities));
    const row = {
      id,
      tenantId: 1,
      title,
      category,
      rewardPoints,
      sortOrder,
      status: 'published',
      participants: 0,
      createdAt: t,
      sourceDomain: 'activity',
      media: [],
    };
    state.activities.push({ id, title, category, rewardPoints, sortOrder, participants: 0 });
    state.pActivities.push(row);
  };

  const ensureProduct = (name, pointsCost, stock, sortOrder) => {
    if (state.mallItems.some((x) => String(x.name) === name) || state.pProducts.some((x) => String(x.name) === name)) return;
    const id = Math.max(nextId(state.mallItems), nextId(state.pProducts));
    state.mallItems.push({ id, tenantId: 1, name, pointsCost, stock, isActive: true, sortOrder, createdAt: t });
    state.pProducts.push({
      id,
      tenantId: 1,
      name,
      description: `${name} 演示商品`,
      pointsCost,
      stock,
      shelfStatus: 'on',
      sortOrder,
      status: 'active',
      createdAt: t,
      media: [],
    });
  };

  const ensureCourse = (title, type, category, points, sortOrder) => {
    if (state.learningCourses.some((x) => String(x.title) === title)) return;
    state.learningCourses.push({
      id: nextId(state.learningCourses),
      tenantId: 1,
      title,
      desc: `${title} 演示内容`,
      type,
      contentType: type,
      category,
      status: 'published',
      rewardPoints: points,
      points,
      sortOrder,
      image: '',
      coverUrl: '',
      content: `${title} 内容`,
      createdAt: t,
    });
  };

  ensureActivity('连续签到7天领鸡蛋', 'sign', 10, 1);
  ensureActivity('完善保障信息', 'task', 100, 2);
  ensureActivity('推荐好友加入', 'invite', 500, 3);

  ensureProduct('智能低糖电饭煲', 99, 50, 1);
  ensureProduct('家庭体检套餐', 79, 80, 2);
  ensureProduct('健康管理咨询券', 59, 999, 3);

  ensureCourse('保险课堂-家庭保障入门', 'article', '保险课堂', 20, 1);
  ensureCourse('趣味游戏-风险识别挑战', 'comic', '趣味游戏', 10, 2);
  ensureCourse('实用工具-理赔资料清单', 'article', '实用工具', 15, 3);

  persistState();
  await closeState();

  console.log(
    JSON.stringify(
      {
        ok: true,
        counts: {
          activities: state.activities.length,
          pActivities: state.pActivities.length,
          mallItems: state.mallItems.length,
          pProducts: state.pProducts.length,
          learningCourses: state.learningCourses.length,
        },
      },
      null,
      2,
    ),
  );
})();
