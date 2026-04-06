import React from 'react';
import Header from '../components/Header';
import CoreFeatures from '../components/CoreFeatures';
import Activities from '../components/Activities';
import PointsBanner from '../components/PointsBanner';
import LatestNews from '../components/LatestNews';
import PopularGames from '../components/PopularGames';
import { User } from '../lib/api';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenInsurance: () => void;
  onOpenLearning: () => void;
  onOpenMall: () => void;
  onOpenActivities: () => void;
  onOpenActivity: (activityId: number) => void;
  onOpenCourse: (courseId: number) => void;
  onOpenAllCourses: () => void;
  onSignIn: () => void;
  user: User | null;
}

export default function Home({
  requireAuth,
  onOpenInsurance,
  onOpenLearning,
  onOpenMall,
  onOpenActivities,
  onOpenActivity,
  onOpenCourse,
  onOpenAllCourses,
  onSignIn,
  user,
}: Props) {
  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <Header customerName={user?.name} />
      <div className="px-4 space-y-6 pt-4">
        <CoreFeatures
          requireAuth={requireAuth}
          onOpenInsurance={onOpenInsurance}
          onOpenLearning={onOpenLearning}
          onSignIn={onSignIn}
        />
        <LatestNews onOpenCourse={onOpenCourse} onViewAll={onOpenAllCourses} />
        <PointsBanner onOpenMall={onOpenMall} />
        <Activities requireAuth={requireAuth} onOpenActivities={onOpenActivities} onOpenActivity={onOpenActivity} />
        <PopularGames requireAuth={requireAuth} />
      </div>
    </div>
  );
}
