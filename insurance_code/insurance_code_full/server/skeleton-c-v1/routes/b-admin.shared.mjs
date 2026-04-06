import { effectiveTemplateStatusForActor, hasRole, isPlatformTemplate } from '../common/template-visibility.mjs';
import { isVisibleTemplateStatus } from '../common/status-policy.mjs';
import { sortRowsByEffectiveTimeDesc } from '../common/effective-time-sort.mjs';

export function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function pickDate(row, keys = ['createdAt']) {
  for (const key of keys) {
    const d = asDate(row?.[key]);
    if (d) return d;
  }
  return null;
}

export function formatDateISO(value) {
  const d = asDate(value);
  return d ? d.toISOString() : new Date().toISOString();
}

export function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function buildMallItemLookup(state = {}) {
  const sourceRows = [
    ...(Array.isArray(state.pProducts) ? state.pProducts : []),
    ...(Array.isArray(state.mallItems) ? state.mallItems : []),
  ];
  const itemById = new Map();
  sourceRows.forEach((row) => {
    const key = Number(row?.sourceProductId || row?.id || 0);
    if (key > 0 && !itemById.has(key)) itemById.set(key, row);
  });
  return itemById;
}

function formatDurationSeconds(value) {
  const total = Math.max(0, Number(value || 0));
  if (!Number.isFinite(total) || total <= 0) return '';
  if (total < 60) return `${Math.round(total)}秒`;
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes}分钟`;
}

export function isEffectiveForAgent(status) {
  return isVisibleTemplateStatus(status);
}

export function isActiveStatus(status) {
  return isVisibleTemplateStatus(status);
}

function resolveHasRole(hasRoleFn) {
  return typeof hasRoleFn === 'function' ? hasRoleFn : hasRole;
}

function resolveBusinessActorRole(state, actor, hasRoleFn) {
  const lookup = resolveHasRole(hasRoleFn);
  const identity = {
    tenantId: Number(actor?.tenantId || 0),
    userType: String(actor?.actorType || 'employee'),
    userId: Number(actor?.actorId || 0),
  };
  if (lookup(state, identity, 'company_admin')) return 'company_admin';
  if (lookup(state, identity, 'team_lead')) return 'team_lead';
  if (lookup(state, identity, 'agent')) return 'agent';
  return 'unknown';
}

export function isCompanyAdminTemplate(state, row, hasRoleFn) {
  const lookup = resolveHasRole(hasRoleFn);
  const creatorRole = String(row?.creatorRole || '').trim().toLowerCase();
  if (creatorRole === 'company_admin') return true;
  if (creatorRole === 'platform_admin') return false;
  const createdBy = Number(row?.createdBy || 0);
  const tenantId = Number(row?.tenantId || 1);
  if (!createdBy) return false;
  if (lookup(state, { tenantId, userType: 'employee', userId: createdBy }, 'platform_admin')) return false;
  return lookup(state, { tenantId, userType: 'employee', userId: createdBy }, 'company_admin');
}

export function isPlatformAdminTemplate(state, row, hasRoleFn) {
  const lookup = resolveHasRole(hasRoleFn);
  const creatorRole = String(row?.creatorRole || '').trim().toLowerCase();
  if (creatorRole === 'platform_admin') return true;
  if (String(row?.templateScope || '').trim().toLowerCase() === 'platform') return true;
  const createdBy = Number(row?.createdBy || 0);
  const tenantId = Number(row?.tenantId || 1);
  if (!createdBy) return false;
  return lookup(state, { tenantId, userType: 'employee', userId: createdBy }, 'platform_admin');
}

export function getBusinessTemplateSource(state, row, hasRoleFn) {
  return isCompanyAdminTemplate(state, row, hasRoleFn) ? 'company' : 'personal';
}

export function getBusinessTemplateTag(state, row, hasRoleFn) {
  return getBusinessTemplateSource(state, row, hasRoleFn) === 'company' ? '公司模板' : '个人模板';
}

function findTemplateSourceById(rows = [], id) {
  return (Array.isArray(rows) ? rows : []).find((row) => Number(row?.id || 0) === Number(id || 0)) || null;
}

export function isDerivedFromPlatformTemplate(state, row, sourceRows = [], hasRoleFn) {
  const visited = new Set();
  let current = row;
  while (Number(current?.sourceTemplateId || 0) > 0) {
    const sourceTemplateId = Number(current?.sourceTemplateId || 0);
    if (!sourceTemplateId || visited.has(sourceTemplateId)) break;
    visited.add(sourceTemplateId);
    const source = findTemplateSourceById(sourceRows, sourceTemplateId);
    if (!source) break;
    if (isPlatformAdminTemplate(state, source, hasRoleFn)) return true;
    current = source;
  }
  return false;
}

export function isDerivedFromCompanyTemplate(state, row, sourceRows = [], hasRoleFn) {
  const visited = new Set();
  let current = row;
  while (Number(current?.sourceTemplateId || 0) > 0) {
    const sourceTemplateId = Number(current?.sourceTemplateId || 0);
    if (!sourceTemplateId || visited.has(sourceTemplateId)) break;
    visited.add(sourceTemplateId);
    const source = findTemplateSourceById(sourceRows, sourceTemplateId);
    if (!source) break;
    if (isCompanyAdminTemplate(state, source, hasRoleFn)) return true;
    current = source;
  }
  return false;
}

export function getBusinessTemplateOriginSource(state, row, sourceRows = [], hasRoleFn) {
  if (isCompanyAdminTemplate(state, row, hasRoleFn)) return 'company';
  return isDerivedFromCompanyTemplate(state, row, sourceRows, hasRoleFn) ? 'company' : 'personal';
}

export function getBusinessTemplateOriginTag(state, row, sourceRows = [], hasRoleFn) {
  return getBusinessTemplateOriginSource(state, row, sourceRows, hasRoleFn) === 'company' ? '公司模板' : '个人模板';
}

export function getBusinessMallTemplateOriginSource(state, row, sourceRows = [], hasRoleFn) {
  if (isPlatformAdminTemplate(state, row, hasRoleFn)) return 'platform';
  if (isDerivedFromPlatformTemplate(state, row, sourceRows, hasRoleFn)) return 'platform';
  return getBusinessTemplateOriginSource(state, row, sourceRows, hasRoleFn);
}

export function getBusinessMallTemplateOriginTag(state, row, sourceRows = [], hasRoleFn) {
  const source = getBusinessMallTemplateOriginSource(state, row, sourceRows, hasRoleFn);
  if (source === 'platform') return '平台模板';
  return source === 'company' ? '公司模板' : '个人模板';
}

export function sortBusinessRowsByEffectiveTimeDesc(rows = []) {
  return sortRowsByEffectiveTimeDesc(rows);
}

export function preferBusinessActorTemplateRows(state, actor, rows = [], hasRoleFn, sourceRows = rows) {
  const actorTenantId = Number(actor?.tenantId || 0);
  const actorId = Number(actor?.actorId || 0);
  if (!actorTenantId || !actorId || !Array.isArray(rows) || rows.length <= 1) return Array.isArray(rows) ? rows : [];

  const overriddenCompanySourceIds = new Set(
    rows
      .filter((row) => Number(row?.tenantId || 0) === actorTenantId)
      .filter((row) => Number(row?.createdBy || 0) === actorId)
      .filter((row) => Number(row?.sourceTemplateId || 0) > 0)
      .filter((row) => getBusinessTemplateSource(state, row, hasRoleFn) !== 'company')
      .filter((row) => getBusinessMallTemplateOriginSource(state, row, sourceRows, hasRoleFn) !== 'platform')
      .map((row) => Number(row?.sourceTemplateId || 0))
  );
  if (!overriddenCompanySourceIds.size) return rows;

  return rows.filter((row) => {
    if (Number(row?.tenantId || 0) !== actorTenantId) return true;
    if (!overriddenCompanySourceIds.has(Number(row?.id || 0))) return true;
    if (getBusinessMallTemplateOriginSource(state, row, sourceRows, hasRoleFn) === 'platform') return true;
    return getBusinessTemplateSource(state, row, hasRoleFn) !== 'company';
  });
}

export function shouldShowToBusinessAgent(state, actor, row, hasRoleFn) {
  const lookup = resolveHasRole(hasRoleFn);
  const identity = {
    tenantId: Number(actor?.tenantId || 0),
    userType: String(actor?.actorType || ''),
    userId: Number(actor?.actorId || 0),
  };
  const isAgent = lookup(state, identity, 'agent');
  if (!isAgent) return true;
  if (!isCompanyAdminTemplate(state, row, lookup)) return true;
  return true;
}

export function canAccessBusinessMallTemplate(state, actor, row, hasRoleFn) {
  const actorRole = resolveBusinessActorRole(state, actor, hasRoleFn);
  if (!['company_admin', 'team_lead', 'agent'].includes(actorRole)) return false;
  const sameTenant = Number(row?.tenantId || 0) === Number(actor?.tenantId || 0);
  if (isPlatformTemplate(state, row) || isPlatformAdminTemplate(state, row, hasRoleFn)) return true;
  if (!sameTenant) return false;
  if (isCompanyAdminTemplate(state, row, hasRoleFn)) return true;
  const creatorRole = String(row?.creatorRole || '').trim().toLowerCase();
  return creatorRole === 'team_lead';
}

export function toBusinessTemplateStatus(state, actor, row, sourceRowsOrHasRoleFn, maybeHasRoleFn) {
  const sourceRows = Array.isArray(sourceRowsOrHasRoleFn) ? sourceRowsOrHasRoleFn : [];
  const hasRoleFn = typeof sourceRowsOrHasRoleFn === 'function' ? sourceRowsOrHasRoleFn : maybeHasRoleFn;
  const actorRole = resolveBusinessActorRole(state, actor, hasRoleFn);
  if (getBusinessMallTemplateOriginSource(state, row, sourceRows, hasRoleFn) === 'platform') {
    return effectiveTemplateStatusForActor(state, actor, row, { inheritedStatus: 'inactive' }) || String(row?.status || 'inactive');
  }
  if (getBusinessTemplateSource(state, row, hasRoleFn) === 'company' && actorRole !== 'company_admin') {
    if (actorRole === 'team_lead' || actorRole === 'agent') return 'inactive';
  }
  return effectiveTemplateStatusForActor(state, actor, row, { inheritedStatus: 'inactive' }) || String(row?.status || 'inactive');
}

export function toBusinessMallTemplateStatus(state, actor, row, sourceRows = [], hasRoleFn) {
  const actorRole = resolveBusinessActorRole(state, actor, hasRoleFn);
  const templateSource = getBusinessMallTemplateOriginSource(state, row, sourceRows, hasRoleFn);
  if (templateSource === 'platform' && actorRole !== 'platform_admin') return 'inactive';
  if (templateSource === 'company' && actorRole !== 'company_admin') {
    if (actorRole === 'team_lead' || actorRole === 'agent') return 'inactive';
  }
  return effectiveTemplateStatusForActor(state, actor, row, { inheritedStatus: 'inactive' }) || String(row?.status || 'inactive');
}

export function isSameTenantRow(row, tenantId) {
  return Number(row?.tenantId || 0) === Number(tenantId || 0);
}

export function isActivityDomainRow(row) {
  const domain = String(row?.sourceDomain || row?.source_domain || 'activity').trim().toLowerCase();
  return domain === 'activity' || domain === '';
}

export function summarizeBehaviorEvent(state, row, context = {}) {
  const event = String(row?.event || row?.eventName || 'unknown');
  const source = String(row?.source || '').trim();
  const path = String(row?.path || '').trim();
  const properties = row?.properties && typeof row.properties === 'object' ? row.properties : {};
  const eventLabelMap = {
    c_learning_enter: '进入知识学习',
    c_learning_switch_tab: '切换学习栏目',
    c_learning_list_load_success: '课程列表加载成功',
    c_learning_list_load_failed: '课程列表加载失败',
    c_learning_filter_category: '筛选课程分类',
    c_learning_open_detail: '打开课程详情',
    c_learning_view_course: '查看课程',
    c_learning_detail_load_success: '课程详情加载成功',
    c_learning_detail_load_failed: '课程详情加载失败',
    c_learning_complete_success: '课程完成领积分成功',
    c_learning_complete_failed: '课程完成领积分失败',
    c_learning_browse_duration: '查看知识学习',
    c_mall_items_load_success: '商城商品加载成功',
    c_mall_activities_load_success: '商城活动加载成功',
    c_mall_redeem_start: '开始兑换商品',
    c_mall_redeem_success: '兑换商品成功',
    c_mall_redeem_failed: '兑换商品失败',
    c_mall_open_redemption_list: '查看兑换记录',
    c_mall_open_product_detail: '查看商品详情',
    c_mall_open_activity_detail: '查看商城活动详情',
    c_mall_activity_join_start: '参与商城活动',
    c_mall_activity_join_success: '参与商城活动成功',
    c_mall_activity_join_failed: '参与商城活动失败',
    c_activity_open_detail: '打开活动详情',
    c_activity_detail_view: '查看活动详情',
    c_activity_detail_load_success: '活动详情加载成功',
    c_activity_detail_load_failed: '活动详情加载失败',
    c_activity_complete_success: '活动完成成功',
    c_activity_complete_failed: '活动完成失败',
    c_activity_browse_duration: '浏览活动',
    c_sign_in_success: '签到成功',
    c_sign_in_repeat: '重复签到',
    c_sign_in_failed: '签到失败',
    c_page_view: '页面浏览',
  };
  const label = eventLabelMap[event] || event;
  const tabToPageLabel = {
    home: '首页',
    learning: '知识学习页',
    activities: '活动中心页',
    profile: '个人中心页',
    insurance: '保障管理页',
    advisor: '顾问页',
    mall: '积分商城页',
  };
  const learningTabLabelMap = {
    learning: '课程学习',
    class: '课程学习',
    classes: '课程学习',
    games: '趣味游戏',
    tools: '实用工具',
  };
  const pathLabelMap = {
    '/': '首页',
    '/home': '首页',
    '/learning': '知识学习页',
    '/activities': '活动中心页',
    '/profile': '个人中心页',
    '/insurance': '保障管理页',
    '/mall': '积分商城页',
    '/advisor': '顾问页',
  };
  const tab = String(properties.tab || '').trim().toLowerCase();
  const inferByEventPrefix = () => {
    if (event.startsWith('c_learning')) return '知识学习页';
    if (event.startsWith('c_mall')) return '积分商城页';
    if (event.startsWith('c_activity') || event.startsWith('c_activities')) return '活动中心页';
    if (event.startsWith('c_profile')) return '个人中心页';
    if (event.startsWith('c_insurance')) return '保障管理页';
    return '';
  };
  const pathParts = (() => {
    if (!path) return { pathname: '', searchParams: new URLSearchParams() };
    const [pathname = '', query = ''] = String(path).split('?');
    return {
      pathname: pathname || '',
      searchParams: new URLSearchParams(query || ''),
    };
  })();
  const normalizedPath = pathParts.pathname || path;
  const routeCourseId = Number(
    properties.courseId
    || properties.course_id
    || pathParts.searchParams.get('courseId')
    || pathParts.searchParams.get('courseid')
    || pathParts.searchParams.get('courseld')
    || 0
  );
  const learningTab = String(properties.learningTab || properties.tab || pathParts.searchParams.get('tab') || '').trim().toLowerCase();
  const pathLabel = (normalizedPath === '/' && tab && tabToPageLabel[tab])
    ? tabToPageLabel[tab]
    : (normalizedPath === '/' ? inferByEventPrefix() || pathLabelMap[normalizedPath] : (pathLabelMap[normalizedPath] || normalizedPath));
  const fallbackLabel = (() => {
    if (!event.startsWith('c_') && !event.startsWith('b_') && !event.startsWith('p_')) return event;
    if (event.endsWith('_load_success')) return '加载成功';
    if (event.endsWith('_load_failed')) return '加载失败';
    if (event.endsWith('_success')) return '操作成功';
    if (event.endsWith('_failed')) return '操作失败';
    return event;
  })();
  const courseById = context.courseById || new Map((state.learningCourses || []).map((c) => [Number(c.id), c]));
  const itemById = context.itemById || buildMallItemLookup(state);
  const activityById = context.activityById
    || new Map([...(state.activities || []), ...(state.mallActivities || []), ...(state.bCustomerActivities || [])].map((a) => [Number(a.id), a]));
  const orderById = context.orderById || new Map((state.orders || []).map((o) => [Number(o.id), o]));

  const courseId = routeCourseId;
  const itemId = Number(
    properties.itemId
    || properties.item_id
    || pathParts.searchParams.get('itemId')
    || pathParts.searchParams.get('itemid')
    || pathParts.searchParams.get('itemld')
    || 0
  );
  const activityId = Number(
    properties.activityId
    || properties.activity_id
    || pathParts.searchParams.get('activityId')
    || pathParts.searchParams.get('activityid')
    || pathParts.searchParams.get('activityld')
    || 0
  );
  const orderId = Number(properties.orderId || properties.order_id || properties.sourceId || 0);
  const order = orderById.get(orderId);
  const course = courseById.get(courseId);
  const item = itemById.get(itemId || Number(order?.productId || 0));
  const activity = activityById.get(activityId || Number(order?.activityId || 0));
  const courseTitle = String(properties.courseTitle || properties.course_title || course?.title || '').trim();
  const activityTitle = String(properties.activityTitle || properties.activity_title || activity?.displayTitle || activity?.title || '').trim();
  const durationLabel = formatDurationSeconds(properties.durationSeconds || properties.duration_seconds || 0);
  const shareType = String(properties.shareType || '').trim().toLowerCase();
  const isLearningShare = shareType === 'learning_course';

  let businessDetail = '';
  if (event.startsWith('c_learning_')) {
    if (courseTitle) businessDetail = `课程:${courseTitle}`;
    else if (courseId > 0) businessDetail = `课程:课程#${courseId}`;
  } else if (event.startsWith('c_mall_redeem')) {
    if (item?.name) businessDetail = `商品:${String(item.name)}`;
    else if (itemId > 0) businessDetail = `商品:商品#${itemId}`;
    else if (order?.productName) businessDetail = `商品:${String(order.productName)}`;
  } else if (event.startsWith('c_mall_activity_') || event === 'c_mall_open_activity_detail') {
    if (activityTitle) businessDetail = `活动:${activityTitle}`;
    else if (activityId > 0) businessDetail = `活动:活动#${activityId}`;
  } else if (event.startsWith('c_activity_')) {
    if (activityTitle) businessDetail = `活动:${activityTitle}`;
    else if (activityId > 0) businessDetail = `活动:活动#${activityId}`;
  } else if (event.startsWith('share_')) {
    if (String(properties.targetTitle || '').trim()) businessDetail = `${isLearningShare ? '课程' : '活动'}:${String(properties.targetTitle).trim()}`;
    else if (isLearningShare && (course?.title || courseId > 0)) businessDetail = `课程:${String(course?.title || `课程#${courseId}`)}`;
    else if (activity?.title || activity?.displayTitle) businessDetail = `活动:${String(activity.displayTitle || activity.title)}`;
  }

  if (event === 'c_page_view') {
    if (normalizedPath === '/learning' || tab === 'learning') {
      if (course?.title) {
        return {
          title: `查看知识学习：${String(course.title)}`,
          detail: learningTabLabelMap[learningTab] ? `栏目：${learningTabLabelMap[learningTab]}` : '知识学习页',
        };
      }
      return {
        title: learningTabLabelMap[learningTab] ? `进入知识学习 · ${learningTabLabelMap[learningTab]}` : '进入知识学习',
        detail: '知识学习页',
      };
    }
    if (normalizedPath === '/activities' || tab === 'activities') {
      if (activity?.title || activity?.displayTitle) {
        return {
          title: `查看活动详情：${String(activity.displayTitle || activity.title)}`,
          detail: '活动中心页',
        };
      }
      return { title: '进入活动中心', detail: '活动中心页' };
    }
    if (normalizedPath === '/mall' || tab === 'mall') {
      if (item?.name || itemId > 0) {
        return {
          title: `查看商品详情：${String(item?.name || `商品#${itemId}`)}`,
          detail: '积分商城页',
        };
      }
      return { title: '进入积分商城', detail: '积分商城页' };
    }
    if (normalizedPath === '/profile' || tab === 'profile') {
      return { title: '进入个人中心', detail: '个人中心页' };
    }
    if (normalizedPath === '/insurance' || tab === 'insurance') {
      return { title: '进入保障管理', detail: '保障管理页' };
    }
    if (pathLabel) {
      return { title: `浏览${pathLabel}`, detail: pathLabel };
    }
  }

  if (event === 'c_learning_enter') {
    if (course?.title) {
      return {
        title: `进入知识学习：${String(course.title)}`,
        detail: course?.category ? `分类：${String(course.category)}` : '知识学习页',
      };
    }
    return {
      title: learningTabLabelMap[learningTab] ? `进入知识学习 · ${learningTabLabelMap[learningTab]}` : '进入知识学习',
      detail: '知识学习页',
    };
  }
  if (event === 'c_learning_browse_duration') {
    return {
      title: `查看知识学习：${courseTitle || (courseId > 0 ? `课程#${courseId}` : '知识学习')}`,
      detail: durationLabel ? `学习时长：${durationLabel}` : '学习时长：未记录',
    };
  }
  if (event === 'c_learning_switch_tab') {
    return {
      title: learningTabLabelMap[learningTab] ? `切换到${learningTabLabelMap[learningTab]}` : '切换知识学习栏目',
      detail: '知识学习页',
    };
  }
  if ((event === 'c_learning_open_detail' || event === 'c_learning_view_course') && course?.title) {
    return {
      title: `查看知识学习：${String(course.title)}`,
      detail: course?.category ? `分类：${String(course.category)}` : '课程详情页',
    };
  }
  if ((event === 'c_activity_open_detail' || event === 'c_activity_detail_view') && (activity?.title || activity?.displayTitle)) {
    return {
      title: `查看活动详情：${String(activity.displayTitle || activity.title)}`,
      detail: '活动中心页',
    };
  }
  if (event === 'c_activity_browse_duration') {
    return {
      title: `浏览活动：${activityTitle || (activityId > 0 ? `活动#${activityId}` : '活动详情')}`,
      detail: durationLabel ? `浏览时长：${durationLabel}` : '浏览时长：未记录',
    };
  }
  if (event === 'c_mall_open_product_detail') {
    return {
      title: `查看商品详情：${String(item?.name || (itemId > 0 ? `商品#${itemId}` : '积分商城商品'))}`,
      detail: '积分商城页',
    };
  }
  if (event === 'c_mall_open_activity_detail') {
    return {
      title: `查看商城活动详情：${String(activity?.displayTitle || activity?.title || (activityId > 0 ? `活动#${activityId}` : '商城活动'))}`,
      detail: '积分商城页',
    };
  }

  const propertyKeys = Object.keys(properties).slice(0, 3);
  const preview = propertyKeys
    .map((k) => `${k}=${String(properties[k])}`)
    .join(' · ');
  if (event.startsWith('share_')) {
    const shareEventLabelMap = {
      share_h5_view: isLearningShare ? '打开学习分享页' : '打开活动分享页',
      share_h5_click_cta: isLearningShare ? '点击去学习' : '点击去参与',
      share_customer_identified: isLearningShare ? '完成学习报名认证' : '完成活动报名认证',
    };
    const targetTitle = String(properties.targetTitle || '').trim();
    const sourceLabel = source === 'share-h5' ? (isLearningShare ? '学习分享 H5' : '分享 H5') : (source || '分享链路');
    const targetLabel = targetTitle ? `${isLearningShare ? '课程' : '活动'}:${targetTitle}` : businessDetail;
    const resolvedTitle = shareEventLabelMap[event] || (label === event ? fallbackLabel : label);
    const detailParts = [sourceLabel ? `来源:${sourceLabel}` : '', targetLabel].filter(Boolean);
    return {
      title: resolvedTitle,
      detail: detailParts.join(' | ') || `${isLearningShare ? '学习' : '活动'}分享互动`,
    };
  }
  const parts = [source ? `来源:${source}` : '', path ? `页面:${pathLabel}` : '', businessDetail, preview].filter(Boolean);
  return {
    title: label === event ? fallbackLabel : label,
    detail: parts.join(' | ') || '行为事件',
  };
}

export function sourceLabel(sourceType, sourceId) {
  const source = String(sourceType || '').toLowerCase();
  if (source === 'sign_in' || source === 'daily_sign_in') return '每日签到';
  if (source === 'activity_task') return '活动任务';
  if (source === 'course_complete' || source === 'learning_course') return '课程完成';
  if (source === 'mall_activity') return '商城活动';
  if (source === 'order_redeem' || source === 'redeem') return `礼券兑换${sourceId ? ` #${sourceId}` : ''}`;
  if (source === 'refund') return '订单退款';
  return String(sourceType || '积分变动');
}
