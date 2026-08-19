export interface CategorySimple {
    id: string;
    name: string;
    type: string;
}

export interface QuoteOriginalTextRef {
    id: string;
    title: string;
    author?: string;
    content?: string;
    summary?: string;
}

export interface QuoteSummary {
    id: string;
    content: string;
    author?: string;
    source?: string;
    summary?: string;
    isFree: boolean;
    categories: CategorySimple[];
    originalText?: QuoteOriginalTextRef;
}

export interface QuoteDetail extends QuoteSummary {
    wordCount: number;
    isLongText: boolean;
    pinyinData?: string;
    collected: boolean;
    inRecitePlan: boolean;
}

export interface CustomQuoteInput {
    content: string;
    author?: string;
    sourceName?: string;
    note?: string;
    categoryIds?: string[];
}

export interface RecitePlanInput {
    quoteId?: string;
    customQuoteId?: string;
}

export interface ReciteReviewInput {
    planId: string;
    action: 'master' | 'not_skilled' | 'skip';
}

export interface CardGenerateInput {
    quoteId?: string;
    customQuoteId?: string;
    templateId?: string;
    backgroundColor?: string;
    fontColor?: string;
}

export interface MemberOrderInput {
    planType: 'monthly' | 'quarterly' | 'yearly';
}

export interface AdRewardVerifyInput {
    adUnitId: string;
    rewardToken: string;
    sign?: string;
}
