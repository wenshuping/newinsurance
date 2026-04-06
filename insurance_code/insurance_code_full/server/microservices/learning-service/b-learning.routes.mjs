import { permissionRequired, tenantContext } from '../../skeleton-c-v1/common/access-control.mjs';
import { toCreateBContentItemCommand, toDeletePLearningCourseCommand, toUpdateBContentItemCommand } from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import { executeCreateBContentItem, executeUpdateBContentItem } from '../../skeleton-c-v1/usecases/b-content-write.usecase.mjs';
import { executeDeletePLearningCourse } from '../../skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';
import { buildBAdminRouteDeps } from '../../skeleton-c-v1/routes/b-admin.deps.mjs';
import {
  getBusinessMallTemplateOriginSource,
  getBusinessMallTemplateOriginTag,
  preferBusinessActorTemplateRows,
  sortBusinessRowsByEffectiveTimeDesc,
  toBusinessTemplateStatus,
} from '../../skeleton-c-v1/routes/b-admin.shared.mjs';

function bContentWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TITLE_REQUIRED') return res.status(400).json({ code, message: '标题不能为空' });
  if (code === 'CONTENT_NOT_FOUND') return res.status(404).json({ code, message: '内容不存在' });
  if (code === 'COURSE_NOT_FOUND') return res.status(404).json({ code, message: '内容不存在' });
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json({ code, message: '平台模板源数据不可直接删除' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '无权限编辑该内容模板' });
  return res.status(400).json({ code: code || 'CONTENT_WRITE_FAILED', message: '内容写入失败' });
}

export function registerLearningServiceBAdminRoutes(router) {
  const deps = buildBAdminRouteDeps();
  const {
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    getState,
    permissionRequired: permissionRequiredFromDeps,
    tenantContext: tenantContextFromDeps,
  } = deps;

  const withTenantContext = tenantContextFromDeps || tenantContext;
  const requirePermission = permissionRequiredFromDeps || permissionRequired;

  router.post('/api/b/content/items', withTenantContext, requirePermission('customer:write'), (req, res) => {
    const command = toCreateBContentItemCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateBContentItem(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  router.put('/api/b/content/items/:id', withTenantContext, requirePermission('customer:write'), (req, res) => {
    const command = toUpdateBContentItemCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateBContentItem(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  router.delete('/api/b/content/items/:id', withTenantContext, requirePermission('customer:write'), (req, res) => {
    const command = toDeletePLearningCourseCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePLearningCourse(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  router.get('/api/b/content/items', withTenantContext, requirePermission('customer:read'), (req, res) => {
    const state = getState();
    const sourceRows = Array.isArray(state.learningCourses) ? state.learningCourses : [];
    const list = sortBusinessRowsByEffectiveTimeDesc(
      preferBusinessActorTemplateRows(
        state,
        req.actor,
        sourceRows.filter((row) => canAccessTemplate(state, req.actor, row)),
        undefined,
        sourceRows,
      )
    )
      .map((row) => {
        const templateSource = getBusinessMallTemplateOriginSource(state, row, sourceRows);
        return {
          id: Number(row.id || 0),
          title: String(row.title || ''),
          status: String(
            toBusinessTemplateStatus(state, req.actor, row, sourceRows)
            || effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'inactive' })
            || row.status
            || 'published'
          ),
          contentType: String(row.contentType || 'article'),
          rewardPoints: Number(row.points || row.rewardPoints || 0),
          sortOrder: Number(row.sortOrder || 0),
          content: String(row.content || ''),
          media: Array.isArray(row.media) ? row.media : [],
          updatedAt: row.updatedAt || row.createdAt || new Date().toISOString(),
          isPlatformTemplate: templateSource === 'platform',
          templateSource,
          templateTag: getBusinessMallTemplateOriginTag(state, row, sourceRows),
        };
      });
    return res.json({ list });
  });
}
