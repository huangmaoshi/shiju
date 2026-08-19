export interface UserInfo {
    id: string;
    openId: string;
    username?: string;
    nickname?: string;
    avatar?: string;
    userType?: string;
    isAdmin: boolean;
    memberLevel: number;
    isPaidMember: boolean;
    isTrialActive: boolean;
    trialExpireAt?: string | null;
    memberExpireDate?: string | null;
    canUseFeature: boolean;
    isBanned: boolean;
}

export interface JwtPayload {
    userId: string;
    openId: string;
}
