import React from 'react';
import Header from '../components/Header';
import AdvisorCard from '../components/AdvisorCard';
import CoreFeatures from '../components/CoreFeatures';
import Activities from '../components/Activities';
import PointsBanner from '../components/PointsBanner';
import LatestNews from '../components/LatestNews';
import PopularGames from '../components/PopularGames';
import type { User } from '../lib/api';

interface Props {
  requireAuth: (action: () => void) => void;
  onOpenMall: () => void;
  user?: User | null;
}

export default function Home({ requireAuth, onOpenMall, user }: Props) {
  return (
    <div className="flex-1 overflow-y-auto pb-24">
      <Header userName={user?.name} />
      <div className="px-4 space-y-6 pt-4">
        <AdvisorCard />
        <CoreFeatures requireAuth={requireAuth} />
        <Activities requireAuth={requireAuth} />
        <PointsBanner onOpenMall={onOpenMall} />
        <LatestNews />
        <PopularGames requireAuth={requireAuth} />
      </div>
    </div>
  );
}
