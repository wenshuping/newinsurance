import { authRequired } from '../common/middleware.mjs';
import { getBalance, getState } from '../common/state.mjs';

export function registerPointsRoutes(app) {
  app.get('/api/points/summary', authRequired, (req, res) => {
    return res.json({ balance: getBalance(req.user.id) });
  });

  app.get('/api/points/transactions', authRequired, (req, res) => {
    const state = getState();
    const list = state.pointTransactions
      .filter((t) => t.userId === req.user.id)
      .sort((a, b) => b.id - a.id);

    return res.json({ list });
  });

  app.get('/api/points/detail', authRequired, (req, res) => {
    const state = getState();
    const context = createPointDetailContext(state);
    const normalized = state.pointTransactions
      .filter((t) => t.userId === req.user.id)
      .map((row) => normalizeTransaction(row, context))
      .sort((a, b) => {
        const at = new Date(a.createdAt).getTime();
        const bt = new Date(b.createdAt).getTime();
        if (bt !== at) return bt - at;
        return Number(b.id || 0) - Number(a.id || 0);
      });

    const groupsMap = new Map();
    normalized.forEach((row) => {
      const key = monthKey(row.createdAt);
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          label: monthLabel(row.createdAt),
          items: [],
        });
      }
      groupsMap.get(key).items.push(row);
    });

    return res.json({
      balance: getBalance(req.user.id),
      groups: [...groupsMap.values()],
    });
  });
}

export function createPointDetailContext(state) {
  const courseById = new Map(
    (Array.isArray(state?.learningCourses) ? state.learningCourses : [])
      .map((row) => [Number(row?.id || 0), row])
      .filter(([id]) => id > 0),
  );

  const activityById = new Map(
    [...(Array.isArray(state?.activities) ? state.activities : []), ...(Array.isArray(state?.mallActivities) ? state.mallActivities : []), ...(Array.isArray(state?.bCustomerActivities) ? state.bCustomerActivities : [])]
      .map((row) => [Number(row?.id || 0), row])
      .filter(([id]) => id > 0),
  );

  const orderById = new Map(
    (Array.isArray(state?.orders) ? state.orders : [])
      .map((row) => [Number(row?.id || 0), row])
      .filter(([id]) => id > 0),
  );

  const productById = new Map();
  [...(Array.isArray(state?.pProducts) ? state.pProducts : []), ...(Array.isArray(state?.mallItems) ? state.mallItems : [])].forEach((row) => {
    const ids = [Number(row?.id || 0), Number(row?.sourceProductId || 0), Number(row?.productId || 0)].filter((id) => id > 0);
    ids.forEach((id) => {
      if (!productById.has(id)) productById.set(id, row);
    });
  });

  return {
    courseById,
    activityById,
    orderById,
    productById,
  };
}

export function normalizeTransaction(row, context = createPointDetailContext({})) {
  const createdAt = row.createdAt || row.created_at || new Date().toISOString();
  const source = String(row.source || row.sourceType || '');
  const sourceId = String(row.sourceId || row.source_id || '');
  const typeRaw = String(row.type || row.direction || 'earn');
  const direction = typeRaw === 'consume' || typeRaw === 'out' ? 'out' : 'in';
  const amount = Math.abs(Number(row.amount) || 0);
  const copy = resolveTransactionCopy({
    row,
    source,
    sourceId,
    direction,
    context,
  });

  return {
    id: Number(row.id) || 0,
    title: copy.title,
    detail: copy.detail,
    amount,
    balance: Number(row.balance),
    direction,
    source,
    createdAt,
  };
}

function resolveTransactionCopy({ row, source, sourceId, direction, context }) {
  const flowLabel = direction === 'in' ? '收入来源' : '支出来源';
  const course = context.courseById.get(Number(sourceId || 0)) || null;
  const activity = context.activityById.get(Number(sourceId || 0)) || null;
  const order = context.orderById.get(Number(sourceId || 0)) || null;
  const product =
    (order?.productName && String(order.productName).trim()) ||
    context.productById.get(Number(order?.productId || 0))?.name ||
    context.productById.get(Number(sourceId || 0))?.name ||
    '';

  if (source.includes('daily_sign_in') || source === 'sign_in' || source.includes('sign')) {
    return {
      title: '每日签到奖励',
      detail: `${flowLabel}：每日签到`,
    };
  }

  if (source === 'onboard') {
    return {
      title: '新用户实名奖励',
      detail: `${flowLabel}：完成基础身份确认`,
    };
  }

  if (source === 'customer_share_identify') {
    return {
      title: '分享好友实名奖励',
      detail: `${flowLabel}：好友通过你的分享完成实名`,
    };
  }

  if (source === 'course_complete') {
    const courseTitle = String(course?.title || '').trim();
    return {
      title: courseTitle ? '知识学习奖励' : '学习奖励',
      detail: `${flowLabel}：${courseTitle ? `完成《${courseTitle}》` : '完成知识学习'}`,
    };
  }

  if (source === 'activity_task') {
    const activityTitle = String(activity?.title || '').trim();
    return {
      title: activityTitle ? '活动奖励' : '活动任务奖励',
      detail: `${flowLabel}：${activityTitle ? `完成《${activityTitle}》` : '完成活动任务'}`,
    };
  }

  if (source === 'mall_activity') {
    const activityTitle = String(activity?.title || '').trim();
    return {
      title: activityTitle ? '活动参与奖励' : '活动参与奖励',
      detail: `${flowLabel}：${activityTitle ? `参与《${activityTitle}》` : '参与积分活动'}`,
    };
  }

  if (source === 'order_pay') {
    return {
      title: '商品兑换',
      detail: `${flowLabel}：${product ? `兑换《${product}》` : row.description || '积分商品兑换'}`,
    };
  }

  if (source === 'order_refund') {
    return {
      title: '退款积分返还',
      detail: `${flowLabel}：${product ? `《${product}》退款返还` : row.description || '订单退款返还'}`,
    };
  }

  if (source === 'order_cancel_refund') {
    return {
      title: '取消兑换返还',
      detail: `${flowLabel}：${product ? `取消兑换《${product}》返还` : row.description || '取消订单返还'}`,
    };
  }

  return {
    title: direction === 'in' ? '积分收入' : '积分支出',
    detail: `${flowLabel}：${row.description || '系统积分变更'}`,
  };
}

function monthKey(isoTime) {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return 'older';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(isoTime) {
  const d = new Date(isoTime);
  if (Number.isNaN(d.getTime())) return '更早';
  const now = new Date();
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return '本月';
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  if (d.getFullYear() === prev.getFullYear() && d.getMonth() === prev.getMonth()) return '上个月';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
