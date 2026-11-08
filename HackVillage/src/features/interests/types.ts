//The data passed between the app, database and display code.

export type Interest = {label: string,standard_id: string,category: string,subcategory: string};
export type InterestProfile = {user_code: string,interests: Interest[]};
export type MatchMode = "interests" | "skills" | "both";
export type FoundUser = {user_code: string,source: "bluetooth" | "infrared"};
export type MatchResult = {score: number | null,matched_pairs: {label_a: string,label_b: string,similarity: number}[],unmatched_a: string[],unmatched_b: string[]};

export interface ProfileStore {
    getMyUserCode?(): Promise<string>;
    getMyProfile(): Promise<InterestProfile>;
    findByCode(code: string): Promise<InterestProfile | null>;
    saveMyInterests(interests: Interest[], shareForMatching: boolean): Promise<void>;
}

export type DiscoverySettings = {self_search: boolean,mode: MatchMode,minimum_score: number};
export type DiscoveryResult = {user_code: string,source: FoundUser["source"],mode: MatchMode,interest_score: number | null,skill_score: number | null,interest_match: MatchResult | null,should_notify: boolean,requires_mutual_acceptance: true,warnings: string[]};
