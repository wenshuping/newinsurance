const ensureLearningCourses = (state) => {
  if (!Array.isArray(state.learningCourses)) state.learningCourses = [];
};

export const findLearningCourseById = ({ state, id }) => {
  ensureLearningCourses(state);
  return state.learningCourses.find((row) => Number(row.id || 0) === Number(id || 0)) || null;
};

export const insertLearningCourse = ({ state, row }) => {
  ensureLearningCourses(state);
  state.learningCourses.push(row);
  return row;
};

export const removeLearningCourseByIndex = ({ state, index }) => {
  ensureLearningCourses(state);
  if (index < 0 || index >= state.learningCourses.length) return false;
  state.learningCourses.splice(index, 1);
  return true;
};

export const findLearningCourseIndexById = ({ state, id }) => {
  ensureLearningCourses(state);
  return state.learningCourses.findIndex((item) => Number(item.id || 0) === Number(id || 0));
};

export const findCompanyOverrideCourseIndex = ({ state, tenantId, sourceTemplateId }) => {
  ensureLearningCourses(state);
  return state.learningCourses.findIndex(
    (item) =>
      Number(item.tenantId || 1) === Number(tenantId || 0) &&
      Number(item.sourceTemplateId || 0) === Number(sourceTemplateId || 0) &&
      String(item.creatorRole || '') === 'company_admin'
  );
};
