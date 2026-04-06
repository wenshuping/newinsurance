import React, { useEffect, useMemo, useState } from 'react';
import { PlayCircle, BookOpen, FileText, Heart } from 'lucide-react';
import { api, type LearningCourse } from '../../lib/api';
import { trackCEvent } from '../../lib/track';
import { resolveRuntimeAssetUrl } from '../../lib/runtime-asset-url';

export interface Course extends Omit<LearningCourse, 'type'> {
  type: 'video' | 'comic' | 'article';
  icon: any;
}

interface Props {
  onSelectCourse: (course: Course) => void;
  refreshToken?: number;
}

function iconByType(type: string) {
  if (type === 'video') return PlayCircle;
  if (type === 'comic') return BookOpen;
  return FileText;
}

function resolveCourseImage(course: Course): string {
  if (course.image) return resolveRuntimeAssetUrl(course.image);
  const media = Array.isArray((course as any).media) ? (course as any).media : [];
  const first = media[0];
  if (typeof first === 'string') return resolveRuntimeAssetUrl(first);
  if (first && typeof first === 'object') {
    return resolveRuntimeAssetUrl(String(first.preview || first.url || first.path || first.name || ''));
  }
  return '';
}

export default function InsuranceClass({ onSelectCourse, refreshToken = 0 }: Props) {
  const [activeCategory, setActiveCategory] = useState('全部');
  const [categories, setCategories] = useState<string[]>(['全部']);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const data = await api.learningCourses();
        if (!mounted) return;
        setCategories(data.categories?.length ? data.categories : ['全部']);
        setCourses((data.courses || []).map((c) => ({ ...c, icon: iconByType(c.type) })));
        trackCEvent('c_learning_list_load_success', { total: Number((data.courses || []).length) });
      } catch (e) {
        trackCEvent('c_learning_list_load_failed', {});
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [refreshToken]);

  const filteredCourses = useMemo(() => {
    if (activeCategory === '全部') return courses;
    return courses.filter((c) => c.category === activeCategory);
  }, [activeCategory, courses]);

  return (
    <div className="py-4">
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              trackCEvent('c_learning_filter_category', { category: cat });
            }}
            className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${
              activeCategory === cat
                ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="px-4 mt-4 space-y-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          我的课程进度
        </h2>

        {loading && <div className="text-sm text-slate-500">课程加载中...</div>}
        {!loading && !filteredCourses.length && <div className="text-sm text-slate-500">当前分类暂无课程</div>}

        {filteredCourses.map((course) => (
          <div
            key={course.id}
            onClick={() => {
              trackCEvent('c_learning_open_detail', { courseId: course.id, category: course.category, type: course.type });
              onSelectCourse(course);
            }}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative h-40 w-full">
              {resolveCourseImage(course) ? (
                <img src={resolveCourseImage(course)} alt={course.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100 text-slate-400">
                  <course.icon size={30} />
                </div>
              )}
              <div className={`absolute top-3 left-3 ${course.color} backdrop-blur-sm text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-bold`}>
                <course.icon size={14} />
                {course.typeLabel}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm p-2 rounded-full shadow-sm text-slate-400 hover:text-red-500 transition-colors"
              >
                <Heart size={18} />
              </button>
            </div>
            <div className="p-4">
              <h3 className="text-lg font-bold mb-1">{course.title}</h3>
              <p className="text-slate-500 text-sm mb-4">{course.desc}</p>

              <div className="mb-4">
                <div className={`flex justify-between items-center mb-1.5 text-xs font-bold ${course.progress > 0 ? 'text-blue-500' : 'text-slate-400'}`}>
                  <span>学习进度 {course.progress}%</span>
                  <span>{course.timeLeft}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${course.progress}%` }}></div>
                </div>
              </div>

              <button className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${course.btnColor}`}>
                {course.action}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
