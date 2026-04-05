export type CUserContract = {
  id: number;
  name: string;
  mobile: string;
  is_verified_basic: boolean;
  verified_at?: string | null;
};

export type VerifyBasicResponseContract = {
  token: string;
  csrfToken?: string;
  user: CUserContract;
};

export type PointsSummaryContract = {
  balance: number;
};

export type ActivityCategory = 'sign' | 'task' | 'invite' | 'competition';

export type ActivityItemContract = {
  id: number;
  title: string;
  category: ActivityCategory;
  rewardPoints: number;
  sortOrder: number;
  participants: number;
  completed: boolean;
  canComplete: boolean;
};
