import {
  toCreateBContentItemCommand,
  toDeletePLearningCourseCommand,
  toReorderPLearningCoursesCommand,
  toUpdateBContentItemCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeCreateBContentItem,
  executeDeleteBContentItem,
  executeReorderBContentItems,
  executeUpdateBContentItem,
} from '../usecases/b-content-write.usecase.mjs';
import {
  getBusinessMallTemplateOriginSource,
  getBusinessMallTemplateOriginTag,
  toBusinessTemplateStatus,
} from './b-admin.shared.mjs';
import { toPLearningCourseAdminView } from '../services/p-learning-course-admin-view.service.mjs';

function bContentWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  if (code === 'TITLE_REQUIRED') return res.status(400).json({ code, message: '标题不能为空' });
  if (code === 'CONTENT_NOT_FOUND') return res.status(404).json({ code, message: '内容不存在' });
  if (code === 'COURSE_NOT_FOUND') return res.status(404).json({ code, message: '内容不存在' });
  if (code === 'COURSE_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一条学习资料顺序' });
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json({ code, message: '平台模板源数据不可直接删除' });
  if (code === 'NO_PERMISSION') return res.status(403).json({ code, message: '无权限编辑该内容模板' });
  return res.status(400).json({ code: code || 'CONTENT_WRITE_FAILED', message: '内容写入失败' });
}

export function registerBAdminContentRoutes(app, deps) {
  const {
    canAccessTemplate,
    decoratePlatformTemplateRow,
    effectiveTemplateStatusForActor,
    getState,
    permissionRequired,
    preferActorTemplateRows,
    tenantContext,
  } = deps;

  app.post('/api/b/content/items', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreateBContentItemCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeCreateBContentItem(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  app.put('/api/b/content/items/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdateBContentItemCommand({ params: req.params, body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeUpdateBContentItem(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  app.delete('/api/b/content/items/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePLearningCourseCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeleteBContentItem(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  app.post('/api/b/content/items/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPLearningCoursesCommand({ body: req.body, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeReorderBContentItems(command)
      .then((payload) => res.json(payload))
      .catch((err) => bContentWriteErrorResponse(res, err));
  });

  app.get('/api/b/content/items', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const sourceRows = Array.isArray(state.learningCourses) ? state.learningCourses : [];
    const list = preferActorTemplateRows(
      state,
      req.actor,
      sourceRows.filter((row) => canAccessTemplate(state, req.actor, row))
    )
      .map((row) => {
      const decorated = decoratePlatformTemplateRow(state, row);
      const templateSource = getBusinessMallTemplateOriginSource(state, row, sourceRows);
      const view = toPLearningCourseAdminView({
        row: decorated,
        status: String(
          toBusinessTemplateStatus(state, req.actor, row, sourceRows)
            || effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'inactive' })
            || row.status
            || 'published'
        ),
        isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
        templateTag: String(decorated.templateTag || ''),
      });
      return {
        ...view,
        isPlatformTemplate: templateSource === 'platform',
        templateSource,
        templateTag: getBusinessMallTemplateOriginTag(state, row, sourceRows),
      };
    })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
    return res.json({ list });
  });
}
