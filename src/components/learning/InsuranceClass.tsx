import React, { useMemo, useState } from 'react';
import { PlayCircle, BookOpen, FileText, Heart } from 'lucide-react';
import { ACTION_COPY } from '../../lib/uiCopy';

export interface Course {
  id: number;
  title: string;
  desc: string;
  type: 'video' | 'comic' | 'article';
  typeLabel: string;
  icon?: any;
  progress: number;
  timeLeft: string;
  image: string;
  action: string;
  color: string;
  btnColor: string;
  points: number;
  content: string;
  category?: string;
  videoUrl?: string;
}

interface Props {
  categories?: string[];
  courses?: Course[];
  loading?: boolean;
  error?: string;
  onSelectCourse: (course: Course) => void;
}

export default function InsuranceClass({ categories: categoriesProp, courses: coursesProp, loading = false, error = '', onSelectCourse }: Props) {
  const [activeCategory, setActiveCategory] = useState(ACTION_COPY.cCategoryAll);
  const categories = (categoriesProp && categoriesProp.length ? categoriesProp : [ACTION_COPY.cCategoryAll, ACTION_COPY.cLearningCategorySenior, ACTION_COPY.cLearningCategoryMedical, ACTION_COPY.cLearningCategoryChild, ACTION_COPY.cLearningCategoryFinance, ACTION_COPY.cLearningCategoryClaim]).filter(Boolean);

  const fallbackCourses: Course[] = [
    {
      id: 1,
      title: ACTION_COPY.cDemoCourse1Title,
      desc: ACTION_COPY.cDemoCourse1Desc,
      type: 'video',
      typeLabel: ACTION_COPY.cDemoCourse1TypeLabel,
      icon: PlayCircle,
      progress: 80,
      timeLeft: ACTION_COPY.cDemoCourse1TimeLeft,
      image: 'https://picsum.photos/seed/course1/800/400',
      action: ACTION_COPY.cDemoCourse1Action,
      color: 'bg-black/60',
      btnColor: 'bg-blue-500 text-white',
      points: 50,
      content: ACTION_COPY.cDemoCourse1Content
    },
    {
      id: 2,
      title: ACTION_COPY.cDemoCourse2Title,
      desc: ACTION_COPY.cDemoCourse2Desc,
      type: 'comic',
      typeLabel: ACTION_COPY.cDemoCourse2TypeLabel,
      icon: BookOpen,
      progress: 0,
      timeLeft: ACTION_COPY.cDemoCourse2TimeLeft,
      image: 'https://picsum.photos/seed/course2/800/400',
      action: ACTION_COPY.cDemoCourse2Action,
      color: 'bg-blue-500',
      btnColor: 'bg-blue-50 text-blue-600',
      points: 30,
      content: ACTION_COPY.cDemoCourse2Content
    },
    {
      id: 3,
      title: ACTION_COPY.cDemoCourse3Title,
      desc: ACTION_COPY.cDemoCourse3Desc,
      type: 'article',
      typeLabel: ACTION_COPY.cDemoCourse3TypeLabel,
      icon: FileText,
      progress: 45,
      timeLeft: ACTION_COPY.cDemoCourse3TimeLeft,
      image: 'https://picsum.photos/seed/course3/800/400',
      action: ACTION_COPY.cDemoCourse3Action,
      color: 'bg-slate-800',
      btnColor: 'bg-blue-500 text-white',
      points: 20,
      content: ACTION_COPY.cDemoCourse3Content
    }
  ];

  const courses = useMemo(() => {
    const source = coursesProp && coursesProp.length ? coursesProp : fallbackCourses;
    if (activeCategory === ACTION_COPY.cCategoryAll) return source;
    return source.filter((course) => String(course.category || '').trim() === activeCategory);
  }, [activeCategory, coursesProp]);

  const iconByType: Record<string, any> = {
    video: PlayCircle,
    comic: BookOpen,
    article: FileText,
  };

  return (
    <div className="py-4">
      {/* Category Filter Pills */}
      <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide whitespace-nowrap pb-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
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

      {/* Course List */}
      <div className="px-4 mt-4 space-y-5">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-500 rounded-full"></span>
          {ACTION_COPY.cLearningProgressTitle}
        </h2>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-500">{ACTION_COPY.cLearningLoadingCourses}</div>
        ) : null}
        {!loading && error ? (
          <div className="bg-white rounded-2xl border border-amber-100 p-6 text-center text-amber-700">{error}</div>
        ) : null}
        {!loading && !error && courses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-slate-500">{ACTION_COPY.cLearningNoCourses}</div>
        ) : null}
        {!loading && !error && courses.map(course => {
          const Icon = iconByType[course.type] || FileText;
          return (
          <div 
            key={course.id} 
            onClick={() => onSelectCourse(course)}
            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="relative h-40 w-full">
              <img 
                src={course.image} 
                alt={course.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className={`absolute top-3 left-3 ${course.color} backdrop-blur-sm text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-xs font-bold`}>
                <Icon size={14} />
                {course.typeLabel}
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); /* toggle favorite */ }}
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
                  <span>{ACTION_COPY.cLearningProgressPrefix}{course.progress}%</span>
                  <span>{course.timeLeft}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${course.progress}%` }}
                  ></div>
                </div>
              </div>
              
              <button className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${course.btnColor}`}>
                {course.action}
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
