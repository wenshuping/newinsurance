import {
  toCreatePLearningCourseBatchCommand,
  toCreatePLearningCourseCommand,
  toDeletePLearningCourseBatchCommand,
  toDeletePLearningCourseCommand,
  toReorderPLearningCoursesCommand,
  toUpdatePLearningCourseCommand,
} from '../dto/write-commands.dto.mjs';
import {
  executeCreatePLearningCourse,
  executeCreatePLearningCourseBatch,
  executeDeletePLearningCourseBatch,
  executeDeletePLearningCourse,
  executeReorderPLearningCourses,
  executeUpdatePLearningCourse,
} from '../usecases/p-learning-course-write.usecase.mjs';
import { createUploadWriteDeps } from '../common/upload-write.deps.mjs';
import { toPLearningCourseAdminView } from '../services/p-learning-course-admin-view.service.mjs';
import {
  getBusinessMallTemplateOriginSource,
  getBusinessMallTemplateOriginTag,
  toBusinessTemplateStatus,
} from './b-admin.shared.mjs';

function learningCourseWriteErrorResponse(res, err) {
  const code = String(err?.code || err?.message || '');
  const itemIndex = Number.isFinite(Number(err?.itemIndex)) ? Number(err.itemIndex) : null;
  const withItemIndex = (payload) => (itemIndex >= 0 ? { ...payload, itemIndex } : payload);
  if (code === 'COMPANY_ACCOUNT_REQUIRED') {
    return res.status(403).json(withItemIndex({ code, message: '仅平台管理员、公司管理员或业务员可新增学习资料' }));
  }
  if (code === 'COURSE_TITLE_REQUIRED') return res.status(400).json(withItemIndex({ code, message: '资料标题不能为空' }));
  if (code === 'COURSE_BATCH_ITEMS_REQUIRED') return res.status(400).json({ code, message: '请至少提交一条学习资料' });
  if (code === 'COURSE_BATCH_ITEMS_LIMIT_EXCEEDED') return res.status(400).json({ code, message: '单次最多导入 20 条学习资料' });
  if (code === 'COURSE_BATCH_DELETE_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少勾选一条学习资料' });
  if (code === 'COURSE_REORDER_IDS_REQUIRED') return res.status(400).json({ code, message: '请至少保留一条学习资料顺序' });
  if (code === 'INVALID_DATA_URL') return res.status(400).json(withItemIndex({ code, message: '上传内容格式错误' }));
  if (code === 'FILE_TOO_LARGE') return res.status(413).json(withItemIndex({ code, message: '文件过大，单文件最大 12MB' }));
  if (code === 'COURSE_NOT_FOUND') return res.status(404).json(withItemIndex({ code, message: '资料不存在' }));
  if (code === 'PLATFORM_TEMPLATE_SOURCE_IMMUTABLE') return res.status(403).json(withItemIndex({ code, message: '平台模板源数据不可直接删除' }));
  if (code === 'NO_PERMISSION') return res.status(403).json(withItemIndex({ code, message: '无权限编辑该学习资料模板' }));
  return res.status(400).json(withItemIndex({ code: code || 'LEARNING_COURSE_WRITE_FAILED', message: '学习资料写入失败' }));
}

export function registerPAdminLearningRoutes(app, deps) {
  const {
    tenantContext,
    permissionRequired,
    getState,
    canAccessTemplate,
    effectiveTemplateStatusForActor,
    decoratePlatformTemplateRow,
    preferActorTemplateRows,
  } = deps;
  const uploadDeps = createUploadWriteDeps();

  app.get('/api/p/learning/courses', tenantContext, permissionRequired('customer:read'), (req, res) => {
    const state = getState();
    const list = preferActorTemplateRows(
      state,
      req.actor,
      (state.learningCourses || []).filter((row) => canAccessTemplate(state, req.actor, row))
    )
      .map((row) => {
        const decorated = decoratePlatformTemplateRow(state, row);
        const view = toPLearningCourseAdminView({
          row: decorated,
          status: String(
            toBusinessTemplateStatus(state, req.actor, row, state.learningCourses || [])
              || effectiveTemplateStatusForActor(state, req.actor, row, { inheritedStatus: 'inactive' })
              || row.status
              || 'published'
          ),
          isPlatformTemplate: Boolean(decorated.isPlatformTemplate),
          templateTag: String(decorated.templateTag || ''),
        });
        return {
          ...view,
          templateSource: getBusinessMallTemplateOriginSource(state, row, state.learningCourses || []),
          templateTag: getBusinessMallTemplateOriginTag(state, row, state.learningCourses || []),
        };
      })
      .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || Number(a.id || 0) - Number(b.id || 0));

    return res.json({ list, courses: list });
  });

  app.post('/api/p/learning/courses', tenantContext, permissionRequired('customer:write'), (req, res) => {
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

  app.post('/api/p/learning/courses/batch', tenantContext, permissionRequired('customer:write'), (req, res) => {
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

  app.post('/api/p/learning/courses/batch-delete', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePLearningCourseBatchCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeDeletePLearningCourseBatch(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });

  app.post('/api/p/learning/courses/reorder', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toReorderPLearningCoursesCommand({
      body: req.body,
      actor: req.actor,
      tenantContext: req.tenantContext,
      deps,
    });
    executeReorderPLearningCourses(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });

  app.put('/api/p/learning/courses/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
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

  app.delete('/api/p/learning/courses/:id', tenantContext, permissionRequired('customer:write'), (req, res) => {
    const command = toDeletePLearningCourseCommand({ params: req.params, actor: req.actor, tenantContext: req.tenantContext, deps });
    executeDeletePLearningCourse(command)
      .then((payload) => res.json(payload))
      .catch((err) => learningCourseWriteErrorResponse(res, err));
  });
}
