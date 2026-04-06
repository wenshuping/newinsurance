import { toAddBCustomerTagCommand, toCreateBCustomTagCommand } from '../dto/write-commands.dto.mjs';
import { executeAddBCustomerTag, executeCreateBCustomTag } from '../usecases/b-customer-tag-write.usecase.mjs';
import { buildMallItemLookup, formatDateISO, sourceLabel, summarizeBehaviorEvent, toNum } from './b-admin.shared.mjs';
import { validateBody } from '../common/middleware.mjs';
import { persistPolicyAnalysisSnapshot } from '../common/state.mjs';
import { generateFamilyPolicyReportBodySchema } from '../schemas/insurance.schemas.mjs';
import { generateFamilyPolicyReport, resolveStoredFamilyPolicyReport } from '../services/family-policy-report.service.mjs';
import { getCustomerShareNetwork } from '../services/share.service.mjs';
import {
  analyzeInsurancePolicyResponsibilities,
  mapAnalysisToPolicyResponsibilities,
  sanitizeStoredPolicyAnalysis,
} from '../services/policy-analysis.service.mjs';

function customerTagWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'CUSTOMER_NOT_FOUND') return res.status(404).json({ code, message: '客户不存在或无权限' });
  if (code === 'TAG_REQUIRED') return res.status(400).json({ code, message: '标签不能为空' });
  if (code === 'TAG_TOO_LONG') return res.status(400).json({ code, message: '标签长度不能超过10' });
  return res.status(400).json({ code: code || 'CUSTOMER_TAG_WRITE_FAILED', message: '客户标签写入失败' });
}

export function registerBAdminCustomerRoutes(app, deps) {
  const {
    appendAuditLog,
    dataScope,
    getState,
    nextId,
    permissionRequired,
    persistState,
    tenantContext,
  } = deps;

  app.get('/api/b/customers', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const customers = (state.users || [])
      .filter((user) => req.dataScope.canAccessCustomer(user))
      .map((user) => ({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        ownerUserId: user.ownerUserId,
        tenantId: user.tenantId,
        orgId: user.orgId,
        teamId: user.teamId,
      }));
    res.json({ list: customers });
  });

  app.get('/api/b/customers/:id/profile', tenantContext, permissionRequired('customer:read'), dataScope('customer'), (req, res) => {
    const state = getState();
    const customerId = Number(req.params.id || 0);
    const customer = (state.users || []).find((row) => Number(row.id) === customerId);
    if (!customer || !req.dataScope.canAccessCustomer(customer)) {
      return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
    }

    const activityById = new Map(
      [...(state.activities || []), ...(state.mallActivities || []), ...(state.bCustomerActivities || [])].map((row) => [Number(row.id), row])
    );
    const itemById = buildMallItemLookup(state);
    const orderById = new Map((state.orders || []).map((row) => [Number(row.id), row]));
    const courseById = new Map((state.learningCourses || []).map((row) => [Number(row.id), row]));

    const interactions = [];
    (state.courseCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const course = courseById.get(Number(row.courseId || 0));
        interactions.push({
          type: 'course_complete',
          title: `已完成：${String(row.courseTitle || course?.title || `课程#${row.courseId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    (state.activityCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const activity = activityById.get(Number(row.activityId || 0));
        const isMallActivity = String(activity?.sourceDomain || '').toLowerCase() === 'mall';
        interactions.push({
          type: 'activity_complete',
          title: `${isMallActivity ? '参与商城活动' : '参与活动'}：${String(activity?.title || activity?.displayTitle || `活动#${row.activityId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || activity?.rewardPoints || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    const signIns = (state.signIns || []).filter((row) => Number(row.userId) === customerId);
    signIns.forEach((row) => {
      interactions.push({
        type: 'sign_in',
        title: '每日签到',
        detail: `签到奖励 +${toNum(row.pointsAwarded || 10)} 积分`,
        occurredAt: formatDateISO(row.createdAt || (row.signDate ? `${row.signDate}T00:00:00.000Z` : null)),
      });
    });

    (state.redemptions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const order = orderById.get(Number(row.orderId || 0));
        const item = itemById.get(Number(row.itemId || order?.productId || 0));
        const orderType = String(order?.orderType || '').toLowerCase();
        const activity = activityById.get(Number(order?.activityId || 0));
        const redeemName = orderType === 'activity'
          ? String(activity?.title || activity?.displayTitle || order?.productName || `活动#${order?.activityId || '-'}`)
          : String(item?.name || order?.productName || `商品#${row.itemId || '-'}`);
        interactions.push({
          type: 'redeem',
          title: `${orderType === 'activity' ? '兑换活动' : '兑换商品'}：${redeemName}`,
          detail: `订单号 #${String(row.orderId || row.id || '-')}`,
          occurredAt: formatDateISO(row.createdAt),
        });
      });

    const tenantTrackRows = (state.trackEvents || []).filter(
      (row) => Number(row.tenantId || 1) === Number(req.tenantContext.tenantId || 0)
    );
    const customerTrackRows = tenantTrackRows.filter(
      (row) => String(row.actorType || '').toLowerCase() === 'customer' && Number(row.actorId || 0) === customerId
    );
    const directShareEventKeys = new Set(
      customerTrackRows
        .filter((row) => String(row.event || '').toLowerCase().startsWith('share_'))
        .map((row) => {
          const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
          return `${String(row.event || '').toLowerCase()}|${String(props.shareCode || '').trim()}`;
        })
    );

    customerTrackRows.forEach((row) => {
        const event = String(row.event || '').toLowerCase();
        const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
        const courseId = Number(props.courseId || props.course_id || 0);
        const course = (state.learningCourses || []).find((c) => Number(c.id) === courseId);
        const targetTitle = String(props.targetTitle || '').trim();
        const shareType = String(props.shareType || '').trim().toLowerCase();
        const isLearningShare = shareType === 'learning_course';
        const shareTargetTitle = targetTitle || (isLearningShare ? String(course?.title || '课程学习') : '活动报名');
        if (event === 'c_learning_enter') {
          interactions.push({
            type: 'course_browse',
            title: '进入知识学习',
            detail: `学习栏目：${String(props.tab || 'class')}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        } else if (event === 'c_learning_open_detail' || event === 'c_learning_view_course') {
          interactions.push({
            type: 'course_view',
            title: `查看课程：${String(course?.title || `课程#${courseId || '-'}`)}`,
            detail: `分类：${String(props.category || course?.category || '-')}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        } else if (event === 'share_h5_view') {
          interactions.push({
            type: isLearningShare ? 'learning_share_view' : 'activity_share_view',
            title: `${isLearningShare ? '打开学习分享页' : '打开活动分享页'}：${shareTargetTitle}`,
            detail: `来源：${isLearningShare ? '学习分享 H5' : '分享 H5'}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        } else if (event === 'share_h5_click_cta') {
          interactions.push({
            type: isLearningShare ? 'learning_share_click' : 'activity_share_click',
            title: `${isLearningShare ? '点击去学习' : '点击去参与'}：${shareTargetTitle}`,
            detail: `来源：${isLearningShare ? '学习分享 H5' : '分享 H5'}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        } else if (event === 'share_customer_identified') {
          interactions.push({
            type: isLearningShare ? 'learning_share_identify' : 'activity_share_identify',
            title: `${isLearningShare ? '完成学习报名认证' : '完成活动报名认证'}：${shareTargetTitle}`,
            detail: `来源：${isLearningShare ? '学习分享 H5' : '分享 H5'}`,
            occurredAt: formatDateISO(row.createdAt),
          });
        }
      });

    const syntheticShareInteractionKeys = new Set();
    const syntheticBehaviorRows = [];
    customerTrackRows
      .filter((row) => String(row.event || '').toLowerCase() === 'share_customer_identified')
      .forEach((identifyRow) => {
        const identifyProps = identifyRow?.properties && typeof identifyRow.properties === 'object' ? identifyRow.properties : {};
        const shareCode = String(identifyProps.shareCode || '').trim();
        const identifyAt = new Date(String(identifyRow.createdAt || '')).getTime();
        if (!shareCode || !Number.isFinite(identifyAt)) return;

        const targetTitle = String(identifyProps.targetTitle || '').trim();
        const shareType = String(identifyProps.shareType || '').trim().toLowerCase();
        const isLearningShare = shareType === 'learning_course';
        const shareTargetTitle = targetTitle || (isLearningShare ? '课程学习' : '活动报名');
        const candidateEvents = [
          ['share_h5_view', isLearningShare ? 'learning_share_view' : 'activity_share_view', `${isLearningShare ? '打开学习分享页' : '打开活动分享页'}：${shareTargetTitle}`],
          ['share_h5_click_cta', isLearningShare ? 'learning_share_click' : 'activity_share_click', `${isLearningShare ? '点击去学习' : '点击去参与'}：${shareTargetTitle}`],
        ];

        for (const [rawEvent, interactionType, title] of candidateEvents) {
          if (directShareEventKeys.has(`${rawEvent}|${shareCode}`)) continue;
          const matched = [...tenantTrackRows]
            .filter((row) => {
              if (String(row.event || '').toLowerCase() !== rawEvent) return false;
              const props = row?.properties && typeof row.properties === 'object' ? row.properties : {};
              if (String(props.shareCode || '').trim() !== shareCode) return false;
              const occurredAt = new Date(String(row.createdAt || '')).getTime();
              return Number.isFinite(occurredAt) && occurredAt <= identifyAt;
            })
            .sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime())[0];
          if (!matched) continue;
          const dedupeKey = `${interactionType}|${shareCode}|${String(matched.createdAt || '')}`;
          if (syntheticShareInteractionKeys.has(dedupeKey)) continue;
          syntheticShareInteractionKeys.add(dedupeKey);
          interactions.push({
            type: interactionType,
            title,
            detail: `来源：${isLearningShare ? '学习分享 H5' : '分享 H5'}`,
            occurredAt: formatDateISO(matched.createdAt),
          });
          syntheticBehaviorRows.push({
            ...matched,
            actorType: 'customer',
            actorId: customerId,
            properties: {
              ...(matched?.properties && typeof matched.properties === 'object' ? matched.properties : {}),
              shareType: String(identifyProps.shareType || matched?.properties?.shareType || ''),
              targetTitle: String(identifyProps.targetTitle || matched?.properties?.targetTitle || ''),
            },
          });
        }
      });

    const interactionTimeline = interactions
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 50);

    const behaviorRows = [];
    const pushBehaviorRow = (key, row) => {
      if (!key || !row) return;
      behaviorRows.push({ key, ...row });
    };

    customerTrackRows.forEach((row, idx) => {
      const summary = summarizeBehaviorEvent(state, row, { courseById, itemById, activityById, orderById });
      pushBehaviorRow(`track:${String(row.event || '')}:${String(row.createdAt || '')}:${idx}`, {
        event: summary.title,
        detail: summary.detail,
        occurredAt: formatDateISO(row.createdAt),
      });
    });

    syntheticBehaviorRows.forEach((row, idx) => {
      const summary = summarizeBehaviorEvent(state, row, { courseById, itemById, activityById, orderById });
      pushBehaviorRow(`synthetic-share:${String(row.event || '')}:${String(row.createdAt || '')}:${idx}`, {
        event: summary.title,
        detail: summary.detail,
        occurredAt: formatDateISO(row.createdAt),
      });
    });

    (state.courseCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const course = courseById.get(Number(row.courseId || 0));
        pushBehaviorRow(`course-complete:${Number(row.id || 0)}:${String(row.completedAt || row.createdAt || '')}`, {
          event: `完成学习：${String(row.courseTitle || course?.title || `课程#${row.courseId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    (state.activityCompletions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const activity = activityById.get(Number(row.activityId || 0));
        const isMallActivity = String(activity?.sourceDomain || '').toLowerCase() === 'mall';
        pushBehaviorRow(`activity-complete:${Number(row.id || 0)}:${String(row.completedAt || row.createdAt || '')}`, {
          event: `${isMallActivity ? '完成商城活动' : '完成活动'}：${String(activity?.title || activity?.displayTitle || `活动#${row.activityId || '-'}`)}`,
          detail: `奖励积分 +${toNum(row.pointsAwarded || activity?.rewardPoints || 0)}`,
          occurredAt: formatDateISO(row.completedAt || row.createdAt),
        });
      });

    signIns.forEach((row) => {
      pushBehaviorRow(`sign-in:${Number(row.id || 0)}:${String(row.createdAt || row.signDate || '')}`, {
        event: '每日签到',
        detail: `签到奖励 +${toNum(row.pointsAwarded || 10)} 积分`,
        occurredAt: formatDateISO(row.createdAt || (row.signDate ? `${row.signDate}T00:00:00.000Z` : null)),
      });
    });

    (state.redemptions || [])
      .filter((row) => Number(row.userId) === customerId)
      .forEach((row) => {
        const order = orderById.get(Number(row.orderId || 0));
        const item = itemById.get(Number(row.itemId || order?.productId || 0));
        const orderType = String(order?.orderType || '').toLowerCase();
        const activity = activityById.get(Number(order?.activityId || 0));
        const redeemName = orderType === 'activity'
          ? String(activity?.title || activity?.displayTitle || order?.productName || `活动#${order?.activityId || '-'}`)
          : String(item?.name || order?.productName || `商品#${row.itemId || '-'}`);
        pushBehaviorRow(`redeem:${Number(row.id || 0)}:${String(row.createdAt || '')}`, {
          event: `${orderType === 'activity' ? '兑换活动' : '兑换商品'}：${redeemName}`,
          detail: `订单号 #${String(row.orderId || row.id || '-')}`,
          occurredAt: formatDateISO(row.createdAt),
        });
      });

    const behaviorTimeline = behaviorRows
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .map(({ key, ...row }) => row)
      .slice(0, 100);

    const pointsTransactions = (state.pointTransactions || [])
      .filter((row) => Number(row.userId) === customerId)
      .map((row) => {
        const amountAbs = Math.abs(toNum(row.amount || 0));
        const isConsume = String(row.type || '').toLowerCase() === 'consume';
        return {
          id: Number(row.id || 0),
          title: sourceLabel(row.source, row.sourceId),
          detail: String(row.description || row.sourceId || ''),
          amount: isConsume ? -amountAbs : amountAbs,
          balance: toNum(row.balance, 0),
          occurredAt: formatDateISO(row.createdAt),
        };
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 100);

    const pointAccount = (state.pointAccounts || []).find((row) => Number(row.userId) === customerId);
    const currentBalance = pointAccount
      ? toNum(pointAccount.balance, 0)
      : pointsTransactions.length
        ? toNum(pointsTransactions[0].balance, 0)
        : 0;
    const policies = (state.policies || [])
      .filter((row) => Number(row.customerId || 0) === customerId)
      .map((row) => ({
        ...row,
        icon: iconByType(row.type),
      }))
      .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    const visibleCustomerIds = new Set(
      (state.users || [])
        .filter((row) => req.dataScope.canAccessCustomer(row))
        .map((row) => Number(row.id || 0))
        .filter((id) => id > 0)
    );
    const shareReferral = getCustomerShareNetwork({
      customerId,
      tenantId: Number(customer.tenantId || req.tenantContext?.tenantId || 0),
      visibleCustomerIds,
    });

    return res.json({
      customer: {
        id: Number(customer.id),
        name: String(customer.name || ''),
        mobile: String(customer.mobile || ''),
      },
      points: {
        currentBalance,
        transactions: pointsTransactions,
      },
      interactionTimeline,
      behaviorTimeline,
      policies,
      shareReferral,
    });
  });

  app.post(
    '/api/b/customers/:id/family-policy-report/resolve',
    tenantContext,
    permissionRequired('customer:read'),
    dataScope('customer'),
    validateBody(generateFamilyPolicyReportBodySchema),
    async (req, res) => {
      const state = getState();
      const customerId = Number(req.params.id || 0);
      const customer = (state.users || []).find((row) => Number(row.id) === customerId);
      if (!customer || !req.dataScope.canAccessCustomer(customer)) {
        return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
      }
      try {
        const result = await resolveStoredFamilyPolicyReport({
          input: req.body,
          reportOwner: {
            tenantId: Number(customer.tenantId || req.tenantId || 1),
            customerId,
          },
        });
        if (!result) {
          return res.status(404).json({ code: 'FAMILY_POLICY_REPORT_NOT_FOUND', message: '当前还没有已归档报告' });
        }
        return res.json({
          ok: true,
          reportId: result.reportId,
          reportMarkdown: result.reportMarkdown,
          sanitizedInput: result.sanitizedInput,
          meta: result.meta,
          cached: Boolean(result.cached),
          stored: Boolean(result.stored),
          reused: Boolean(result.reused),
        });
      } catch (_err) {
        return res.status(500).json({ code: 'FAMILY_POLICY_REPORT_FAILED', message: '家庭报告读取失败，请稍后重试' });
      }
    }
  );

  app.post(
    '/api/b/customers/:id/family-policy-report',
    tenantContext,
    permissionRequired('customer:read'),
    dataScope('customer'),
    validateBody(generateFamilyPolicyReportBodySchema),
    async (req, res) => {
      const state = getState();
      const customerId = Number(req.params.id || 0);
      const customer = (state.users || []).find((row) => Number(row.id) === customerId);
      if (!customer || !req.dataScope.canAccessCustomer(customer)) {
        return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
      }
      try {
        const result = await generateFamilyPolicyReport({
          input: req.body,
          reportOwner: {
            tenantId: Number(customer.tenantId || req.tenantId || 1),
            customerId,
          },
        });
        return res.json({
          ok: true,
          reportId: result.reportId,
          reportMarkdown: result.reportMarkdown,
          sanitizedInput: result.sanitizedInput,
          meta: result.meta,
          cached: Boolean(result.cached),
          stored: Boolean(result.stored),
          reused: Boolean(result.reused),
        });
      } catch (err) {
        const code = String(err?.code || err?.message || 'FAMILY_POLICY_REPORT_FAILED');
        if (code === 'FAMILY_POLICY_REPORT_PROVIDER_NOT_READY') {
          return res.status(503).json({ code, message: '家庭报告服务未配置，请联系管理员' });
        }
        if (code === 'FAMILY_POLICY_REPORT_TIMEOUT') {
          return res.status(504).json({ code, message: '家庭报告生成超时，请稍后重试' });
        }
        if (code === 'FAMILY_POLICY_REPORT_EMPTY') {
          return res.status(502).json({ code, message: '家庭报告结果为空，请稍后重试' });
        }
        if (code === 'FAMILY_POLICY_REPORT_UPSTREAM_FAILED') {
          return res.status(502).json({ code, message: '家庭报告服务暂不可用，请稍后重试' });
        }
        return res.status(500).json({ code: 'FAMILY_POLICY_REPORT_FAILED', message: '家庭报告生成失败，请稍后重试' });
      }
    }
  );

  app.post(
    '/api/b/customers/:id/policies/:policyId/analyze',
    tenantContext,
    permissionRequired('customer:read'),
    dataScope('customer'),
    async (req, res) => {
      const state = getState();
      const customerId = Number(req.params.id || 0);
      const policyId = Number(req.params.policyId || 0);
      const customer = (state.users || []).find((row) => Number(row.id) === customerId);
      if (!customer || !req.dataScope.canAccessCustomer(customer)) {
        return res.status(404).json({ code: 'CUSTOMER_NOT_FOUND', message: '客户不存在或无权限' });
      }
      const policy = (state.policies || []).find((row) => Number(row.id) === policyId && Number(row.customerId || 0) === customerId);
      if (!policy) {
        return res.status(404).json({ code: 'POLICY_NOT_FOUND', message: '保单不存在' });
      }
      try {
        const storedAnalysis = sanitizeStoredPolicyAnalysis(policy.analysis);
        if (storedAnalysis) {
          policy.analysis = storedAnalysis;
          return res.json({ ok: true, analysis: storedAnalysis, policy });
        }
        const analysis = await analyzeInsurancePolicyResponsibilities({
          policy,
        });
        const nextResponsibilities = mapAnalysisToPolicyResponsibilities(analysis, {
          amount: policy.amount,
          firstPremium: policy.annualPremium,
        });
        const analysisSnapshot = sanitizeStoredPolicyAnalysis(analysis);
        if (analysisSnapshot) {
          policy.analysis = analysisSnapshot;
        }
        if (nextResponsibilities.length) {
          policy.responsibilities = nextResponsibilities;
        }
        policy.updatedAt = new Date().toISOString();
        await persistPolicyAnalysisSnapshot({
          policyId: policy.id,
          analysis: analysisSnapshot,
          responsibilities: policy.responsibilities,
          updatedAt: policy.updatedAt,
        });
        return res.json({ ok: true, analysis, policy });
      } catch (err) {
        const code = String(err?.code || err?.message || 'POLICY_ANALYSIS_FAILED');
        if (code === 'POLICY_ANALYSIS_PROVIDER_NOT_READY') {
          return res.status(503).json({ code, message: '保单责任分析服务未配置，请先设置 DeepSeek Key' });
        }
        if (code === 'POLICY_ANALYSIS_TIMEOUT') {
          return res.status(504).json({ code, message: '保单责任分析超时，请稍后重试' });
        }
        if (code === 'POLICY_ANALYSIS_EMPTY' || code === 'POLICY_ANALYSIS_INVALID_JSON') {
          return res.status(502).json({ code, message: '保单责任分析结果异常，请稍后重试' });
        }
        if (code === 'POLICY_ANALYSIS_UPSTREAM_FAILED') {
          return res.status(502).json({ code, message: '保单责任分析服务暂不可用，请稍后重试' });
        }
        return res.status(500).json({ code: 'POLICY_ANALYSIS_FAILED', message: '保单责任分析失败，请稍后重试' });
      }
    }
  );

  app.post('/api/b/customers/:id/tags', tenantContext, permissionRequired('customer:write'), dataScope('customer'), (req, res) => {
    const command = toAddBCustomerTagCommand({
      params: req.params,
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      dataScope: req.dataScope,
      deps,
    });
    executeAddBCustomerTag(command)
      .then((payload) => res.json(payload))
      .catch((err) => customerTagWriteErrorResponse(res, err));
  });

  app.get('/api/b/tags/library', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const tenantId = Number(req.tenantContext.tenantId);
    const list = (state.bCustomerTags || []).filter((row) => Number(row.tenantId) === tenantId);
    const recommended = ['养老规划', '教育金需求', '高净值'];
    const groups = [
      { key: 'intent', name: '意向程度', items: ['强意向', '中等意向', '观望中', '无意向'] },
      { key: 'product', name: '产品意向', items: ['医疗险', '年金险', '家庭财产险', '意外险', '定期寿险'] },
      { key: 'family', name: '家庭情况', items: ['单身贵族', '新婚夫妇', '三口之家', '二胎家庭', '退休生活'] },
    ];
    return res.json({ list, recommended, groups });
  });

  app.post('/api/b/tags/custom', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateBCustomTagCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeCreateBCustomTag(command)
      .then((payload) => res.json(payload))
      .catch((err) => customerTagWriteErrorResponse(res, err));
  });
}

function iconByType(type) {
  if (type === '医疗') return 'stethoscope';
  if (type === '重疾') return 'heart-pulse';
  if (type === '意外') return 'shield';
  return 'shield';
}
