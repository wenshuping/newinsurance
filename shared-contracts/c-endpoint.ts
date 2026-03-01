import type { CUserContract } from './common';

export type HealthResponseContract = {
  ok: boolean;
  service: string;
};

export type SendCodeRequestContract = {
  mobile: string;
};

export type SendCodeResponseContract = {
  ok: boolean;
  message: string;
  dev_code?: string;
};

export type VerifyBasicRequestContract = {
  name: string;
  mobile: string;
  code: string;
};

export type VerifyBasicResponseContract = {
  token: string;
  user: CUserContract;
};

export type MeResponseContract = {
  user: CUserContract;
  balance: number;
};

export type ActivityItemContract = {
  id: number;
  title: string;
  category: string;
  rewardPoints: number;
  sortOrder: number;
  participants: number;
  completed: boolean;
  canComplete: boolean;
};

export type ActivitiesResponseContract = {
  activities: ActivityItemContract[];
  balance: number;
};

export type SignInResponseContract = {
  ok: boolean;
  reward: number;
  balance: number;
};

export type PointsSummaryResponseContract = {
  balance: number;
};

export type PointTransactionItemContract = {
  id: number;
  userId: number;
  type: 'earn' | 'consume';
  amount: number;
  source: string;
  sourceId: string;
  balance: number;
  description: string;
  createdAt: string;
};

export type PointsTransactionsResponseContract = {
  list: PointTransactionItemContract[];
};

export type MallItemContract = {
  id: number;
  name: string;
  pointsCost: number;
  stock: number;
  isActive: boolean;
  imageUrl: string;
  category: string;
};

export type MallItemsResponseContract = {
  items: MallItemContract[];
};

export type RedeemRequestContract = {
  itemId: number;
};

export type RedeemResponseContract = {
  ok: boolean;
  token: string;
  balance: number;
};

export type RedemptionItemContract = {
  id: number;
  userId: number;
  itemId: number;
  pointsCost: number;
  status: 'pending' | 'written_off';
  writeoffToken: string;
  expiresAt: string;
  createdAt: string;
  writtenOffAt: string | null;
  itemName: string;
};

export type RedemptionsResponseContract = {
  list: RedemptionItemContract[];
};

export type WriteoffRequestContract = {
  token?: string;
};

export type WriteoffResponseContract = {
  ok: true;
};

