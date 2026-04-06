const ensureLearningCourses = (state) => {
  if (!Array.isArray(state.learningCourses)) state.learningCourses = [];
};

const ensurePLearningMaterials = (state) => {
  if (!Array.isArray(state.pLearningMaterials)) state.pLearningMaterials = [];
};

export const findLearningCourseIndexById = ({ state, id }) => {
  ensureLearningCourses(state);
  return state.learningCourses.findIndex((item) => Number(item.id || 0) === Number(id || 0));
};

export const findLearningCourseById = ({ state, id }) => {
  ensureLearningCourses(state);
  return state.learningCourses.find((x) => Number(x.id || 0) === Number(id || 0)) || null;
};

export const findCompanyOverrideCourseIndex = ({ state, tenantId, sourceTemplateId }) => {
  ensureLearningCourses(state);
  return state.learningCourses.findIndex(
    (item) =>
      Number(item.tenantId || 0) === Number(tenantId || 0) &&
      Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
      String(item.creatorRole || '').trim().toLowerCase() === 'company_admin'
  );
};

export const findActorLearningCourseOverrideBySource = ({ state, tenantId, sourceTemplateId, actorId }) => {
  ensureLearningCourses(state);
  return (
    state.learningCourses.find(
      (item) =>
        Number(item.tenantId || 0) === Number(tenantId || 0) &&
        Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
        Number(item.createdBy || 0) === Number(actorId || 0) &&
        !['company_admin', 'platform_admin'].includes(String(item.creatorRole || '').trim().toLowerCase())
    ) || null
  );
};

export const insertLearningCourse = ({ state, row }) => {
  ensureLearningCourses(state);
  state.learningCourses.push(row);
  return row;
};

export const removeLearningCourseByIndex = ({ state, index }) => {
  ensureLearningCourses(state);
  if (index < 0 || index >= state.learningCourses.length) return null;
  const [removed] = state.learningCourses.splice(index, 1);
  return removed || null;
};

export const insertPLearningMaterial = ({ state, row }) => {
  ensurePLearningMaterials(state);
  state.pLearningMaterials.push(row);
  return row;
};

export const findPLearningMaterialByCourseId = ({ state, courseId }) => {
  ensurePLearningMaterials(state);
  return state.pLearningMaterials.find((material) => Number(material.sourceCourseId || material.id || 0) === Number(courseId || 0)) || null;
};

export const forEachPLearningMaterialByCourseId = ({ state, courseId, callback }) => {
  ensurePLearningMaterials(state);
  state.pLearningMaterials.forEach((material) => {
    if (Number(material.sourceCourseId || material.id || 0) !== Number(courseId || 0)) return;
    callback(material);
  });
};

export const removePLearningMaterialsByCourseId = ({ state, courseId }) => {
  ensurePLearningMaterials(state);
  const targetId = Number(courseId || 0);
  if (!targetId) return 0;
  const before = state.pLearningMaterials.length;
  state.pLearningMaterials = state.pLearningMaterials.filter(
    (material) => Number(material.sourceCourseId || material.id || 0) !== targetId
  );
  return before - state.pLearningMaterials.length;
};
