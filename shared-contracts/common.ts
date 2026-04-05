export type ActorType = 'employee' | 'agent' | 'customer' | string;

export type RoleType =
  | 'platform_admin'
  | 'company_admin'
  | 'team_lead'
  | 'agent'
  | string;

export type BaseSessionContract = {
  account: string;
  name: string;
  token?: string;
  actorType: ActorType;
  actorId: number;
  tenantId: number;
  orgId: number;
  teamId: number;
  csrfToken?: string;
};

export type PLoginSessionContract = BaseSessionContract & {
  role: RoleType;
};

export type BLoginSessionContract = BaseSessionContract & {
  mobile?: string;
  role: Exclude<RoleType, 'platform_admin'>;
};

export type ContractEnvelope<T> = {
  code: number;
  message: string;
  data: T;
  requestId?: string;
  timestamp?: number;
};
