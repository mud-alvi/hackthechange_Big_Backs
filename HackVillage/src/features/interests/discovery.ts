import {readUserCode} from "./interest_data";
import {calculateInterestMatch} from "./interest_matcher";
import type {DiscoveryResult, DiscoverySettings, FoundUser, ProfileStore} from "./types";

export type SkillMatcher = (otherCode: string) => Promise<number | null>;

export function createDiscoveryHandler(store: ProfileStore, getSkillScore?: SkillMatcher, clock = Date.now) {
    const lastNotice = new Map<string, number>();
    const busy = new Set<string>();
    let generation = 0;
    //Call reset when switching account, mode, threshold, profile or self-search.
    function reset() { generation++; lastNotice.clear(); busy.clear(); }

    async function handle(found: FoundUser, settings: DiscoverySettings): Promise<DiscoveryResult | null> {
        if (!["bluetooth", "infrared"].includes(found.source)) throw new Error("Unknown discovery method.");
        if (!["interests", "skills", "both"].includes(settings.mode)) throw new Error("Unknown matching mode.");
        if (typeof settings.self_search !== "boolean") throw new Error("Self-search must be on or off.");
        if (!Number.isFinite(settings.minimum_score) || settings.minimum_score < 0 || settings.minimum_score > 100) {
            throw new Error("The minimum score must be between 0 and 100.");
        }
        if (found.source === "bluetooth" && !settings.self_search) return null;
        const code = readUserCode(found.user_code);
        const key = `${code}:${found.source}:${settings.mode}`;
        if (busy.has(key)) return null;
        const started = generation;
        busy.add(key);
        try {
            const myCode = store.getMyUserCode ? await store.getMyUserCode() : (await store.getMyProfile()).user_code;
            if (code === myCode) return null;
            const result: DiscoveryResult = {user_code: code,source: found.source,mode: settings.mode,interest_score: null,skill_score: null,interest_match: null,should_notify: false,requires_mutual_acceptance: true,warnings: []};
            if (settings.mode !== "skills") {
                try {
                    const [me, other] = await Promise.all([store.getMyProfile(), store.findByCode(code)]);
                    if (!other) throw new Error('No matching profile.');
                    result.interest_match = calculateInterestMatch(me.interests, other.interests);
                    result.interest_score = result.interest_match.score;
                    if (result.interest_score === null) result.warnings.push("Interest data is missing.");
                } catch {
                    result.warnings.push('Interest data could not be loaded.');
                }
            }
            if (settings.mode !== "interests") {
                if (!getSkillScore) {
                    result.warnings.push("The skills matcher has not been connected yet.");
                } else {
                    try {
                        const score = await getSkillScore(code);
                        if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error("Invalid skill score.");
                        result.skill_score = score;
                        if (score === null) result.warnings.push("Skill data is missing.");
                    } catch {
                        result.warnings.push("The skill score could not be calculated.");
                    }
                }
            }
            if (started !== generation) return null;
            const meetsMinimum = [result.interest_score, result.skill_score].some(score => score !== null && score >= settings.minimum_score);
            //Infrared is an intentional request, even if no score is available.
            result.should_notify = found.source === "infrared" || meetsMinimum;
            if (found.source === "bluetooth" && result.should_notify) {
                const previous = lastNotice.get(key);
                if (previous !== undefined && clock() - previous < 60000) result.should_notify = false;
                else lastNotice.set(key, clock());
                for (const [oldKey, time] of lastNotice) if (clock() - time >= 60000) lastNotice.delete(oldKey);
            }
            return result;
        } finally {
            if (started === generation) busy.delete(key);
        }
    }
    return {handle,reset};
}
