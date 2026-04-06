import { tenantContext } from '../../skeleton-c-v1/common/access-control.mjs';
import {
  toCreatePLearningCourseBatchCommand,
  toCreatePLearningCourseCommand,
  toDeletePLearningCourseCommand,
  toUpdatePLearningCourseCommand,
} from '../../skeleton-c-v1/dto/write-commands.dto.mjs';
import {
  executeCreatePLearningCourse,
  executeCreatePLearningCourseBatch,
  executeDeletePLearningCourse,
  executeUpdatePLearningCourse,
} from '../../skeleton-c-v1/usecases/p-learning-course-write.usecase.mjs';
import { buildLearningDeps } from '../../skeleton-c-v1/routes/p-admin.deps.mjs';
import { createUploadWriteDeps } from '../../skeleton-c-v1/common/upload-write.deps.mjs';
import { toPLearningCourseAdminView } from '../../skeleton-c-v1/services/p-learning-course-admin-view.service.mjs';

function learningCourseWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  const itemIndex = Number.isFinite(Number(err?.itemIndex)) ? Number(err.itemIndex) : null;
  const withItemIndex = (payload) => (itemIndex >= 0 ? { ...payload, itemIndex } : payload);
  if (code === 'COMPANY_ACCOUNT_REQUIRED') {
    return res.status(403).json(withItemIndex({ code, message: '仅平台管理员、公司管理员或业务员可新增学习资料(v2)' }));
  }
  if (code === 'COURSE_TITLE_REQUIRED') return res.status(400).json(withItemIndex({ code, message: '资料标题不能为空' }));
  if (code === 'COURSE_BATCH_ITEMS_REQUIRED') return res.status(400).json({ code, message: '请至少提交一条学习资料' });
  if (code === 'COURSE_BATCH_ITEMS_LIMIT_EXCEEDED') return res.status(400).json({ code, message: '单次最多导入 20 条学习资料' });
  if (code === 'INVALID_DATA_URL') return res.status(400).json(withItemIndex({ code, message: '上传内容格式错误' }));
  if (code === 'FILE_TOO_LARGE') return res.status(413).json(withItemIndex({ code, message: '文件过大，单文件最大 12MB' }));
  if (code === 'COURSE_NOT_FOUND') return res.status(404).json(withItemIndex({ code, message: '资料不存在' }));
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json(withItemIndex({ code, message: '平台模板源数据不可直接删除' }));
  if (code === 'NO_PERMISSION') return res.status(403).json(withItemIndex({ code, message: '无权限编辑该学习资料模板' }));
  return res.status(400).json(withItemIndex({ code: code || 'LEARNING_COURSE_WRITE_FAILED', message: '学习资料写入失败' }));
}

export function registerLearningServiceAdminRoutes(router) {
  const deps = buildLearningDeps();
  const {
    tenantContext: tenantContextFromDeps,
    permissionRequired,
    getState,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    decoratePlatformTemplateRow,
    preferActorTemplateRows,
  } = deps;
  const withTenantContext = tenantContextFromDeps || tenantContext;
  const uploadDeps = createUploadWriteDeps();

  router.get('/api/p/learning/courses', withTenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = preferActorTemplateRows(
      state,
      req.actor,
      (state.learningCourses || []).filter((row) => canAccessTemplate(state, req.actor, row))
    )
      .map((row) => {
        const decorated = decoratePlatformTemplateRow(state, row);
        return toPLearningCourseAdminView({
          row: decorated,
          status: String(
            effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'inactive' })
            || row.status
            || 'published'
          ),
          isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
          templateTag: String(decorated.templateTag || ''),
        });
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));
    return res.json({ list, courses: list });
  });

  router.post('/api/p/learning/courses', withTenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePLearningCourseCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      headers: req.headers,
      protocol: req.protocol,
      host: req.get('host'),
      deps: { ...deps, uploadDeps },
    });
    executeCreatePLearningCourse(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });

  router.post('/api/p/learning/courses/batch', withTenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toCreatePLearningCourseBatchCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      headers: req.headers,
      protocol: req.protocol,
      host: req.get('host'),
      deps: { ...deps, uploadDeps },
    });
    executeCreatePLearningCourseBatch(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });

  router.put('/api/p/learning/courses/:id', withTenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toUpdatePLearningCourseCommand({
      params: req.params,
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeUpdatePLearningCourse(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });

  router.delete('/api/p/learning/courses/:id', withTenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePLearningCourseCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePLearningCourse(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });
}
