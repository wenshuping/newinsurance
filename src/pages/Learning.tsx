import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import InsuranceClass, { Course } from '../components/learning/InsuranceClass';
import FunGames from '../components/learning/FunGames';
import PracticalTools from '../components/learning/PracticalTools';
import CourseDetail from '../components/learning/CourseDetail';
import { api, type LearningCourse } from '../lib/api';
import { ERROR_COPY } from '../lib/errorCopy';
import { ACTION_COPY } from '../lib/uiCopy';

export default function Learning() {
  const [activeTab, setActiveTab] = useState('class'); // class, games, tools
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [categories, setCategories] = useState<string[]>([ACTION_COPY.cCategoryAll]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const mapCourse = (item: LearningCourse): Course => ({
      id: Number(item.id || 0),
      title: String(item.title || ''),
      desc: String(item.desc || ''),
      category: String(item.category || ''),
      type: item.type || 'article',
      typeLabel: String(item.typeLabel || ACTION_COPY.cLearningTypeArticle),
      progress: Number(item.progress || 0),
      timeLeft: String(item.timeLeft || ''),
      image: String(item.image || ''),
      action: String(item.action || ACTION_COPY.cLearningActionStart),
      color: String(item.color || 'bg-blue-500/90'),
      btnColor: String(item.btnColor || 'bg-blue-500 text-white'),
      points: Number(item.points || 0),
      content: String(item.content || ''),
      videoUrl: String(item.videoUrl || ''),
    });

    setLoading(true);
    setError('');
    api.learningCourses()
      .then((res) => {
        if (!mounted) return;
        const list = Array.isArray(res.courses) ? res.courses.map(mapCourse) : [];
        const categoryList = Array.isArray(res.categories) ? res.categories.filter(Boolean) : [];
        setCourses(list);
        setCategories(categoryList.length ? categoryList : [ACTION_COPY.cCategoryAll]);
      })
      .catch(() => {
        if (!mounted) return;
        // Keep fallback list from component if API is temporarily unavailable.
        setCourses([]);
        setCategories([ACTION_COPY.cCategoryAll]);
        setError(ERROR_COPY.learningCourseLoadFallback);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const mergedCourses = useMemo(() => courses, [courses]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 min-h-screen pb-24">
      {/* Top Navigation Header */}
      <header className="bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center p-4">
          <button className="p-1 -ml-1 text-slate-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="flex-1 text-center text-xl font-bold">{ACTION_COPY.cLearningTitle}</h1>
          <button className="p-1 -mr-1 text-slate-700">
            <Search size={24} />
          </button>
        </div>
        
        {/* Tab Bar */}
        <div className="flex border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('class')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'class' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            {ACTION_COPY.cLearningTabClass}
          </button>
          <button 
            onClick={() => setActiveTab('games')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'games' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            {ACTION_COPY.cLearningTabGames}
          </button>
          <button 
            onClick={() => setActiveTab('tools')}
            className={`flex-1 py-3 text-center font-bold text-base border-b-4 transition-colors ${activeTab === 'tools' ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500'}`}
          >
            {ACTION_COPY.cLearningTabTools}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'class' && (
          <InsuranceClass
            categories={categories}
            courses={mergedCourses}
            loading={loading}
            error={error}
            onSelectCourse={setSelectedCourse}
          />
        )}
        {activeTab === 'games' && <FunGames />}
        {activeTab === 'tools' && <PracticalTools />}
      </main>

      {/* Course Detail Overlay */}
      <AnimatePresence>
        {selectedCourse && (
          <CourseDetail 
            course={selectedCourse} 
            onBack={() => setSelectedCourse(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
