import {readInterests, readLabels, readUserCode} from "./interest_data.ts";
import type {Interest, InterestProfile, ProfileStore} from "./types.ts";

//Confirm these names against your friend's database before going live.
export const DATABASE = {profiles: "profiles",interests: "user_interests",lookup: "lookup_interest_profile",normalizer: "normalize-interests"};

export type StoreOptions = {url: string,publishableKey: string,getSession: () => Promise<{access_token: string,user: {id: string}} | null>,fetcher?: typeof fetch};

export function createSupabaseStore(options: StoreOptions): ProfileStore & {normalize(labels: string[]): Promise<Interest[]>} {
    const base = options.url.replace(/\/$/, "");
    if (!base.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) {
        throw new Error("Use your Supabase HTTPS project URL.");
    }
    if (!options.publishableKey) throw new Error("The Supabase publishable key is missing.");
    const send = options.fetcher || fetch;

    async function session() {
        const value = await options.getSession();
        if (!value?.access_token || !value.user?.id) throw new Error("Please sign in first.");
        return value;
    }

    async function request(path: string, token: string, method = "GET", body?: unknown, prefer?: string): Promise<unknown> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), path.startsWith("/functions/") ? 90000 : 15000);
        try {
            const headers: Record<string, string> = {apikey: options.publishableKey,Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
            if (prefer) headers.Prefer = prefer;
            const response = await send(base + path, {method,headers,signal: controller.signal,body: body === undefined ? undefined : JSON.stringify(body)});
            if (!response.ok) {
                if (response.status === 401) throw new Error("Your session expired. Sign in again.");
                throw new Error(`The Supabase request failed (${response.status}). Check the setup and access rules.`);
            }
            const text = await response.text();
            return text ? JSON.parse(text) : null;
        } finally {
            clearTimeout(timer);
        }
    }

    async function getMyProfile(): Promise<InterestProfile> {
        const signedIn = await session();
        const id = encodeURIComponent(signedIn.user.id);
        const rows = await request(`/rest/v1/${DATABASE.profiles}?select=user_code&id=eq.${id}`, signedIn.access_token);
        if (!Array.isArray(rows) || rows.length !== 1) throw new Error("Your permanent user code has not been set up.");
        const user_code = readUserCode(rows[0].user_code);
        const interests = await request(`/rest/v1/${DATABASE.interests}?select=interests&owner_id=eq.${id}`, signedIn.access_token);
        if (!Array.isArray(interests) || interests.length > 1) throw new Error("Unexpected interest data from Supabase.");
        return {user_code,interests: readInterests(interests[0]?.interests ?? [])};
    }

    return {
        getMyProfile,
        async findByCode(code) {
            code = readUserCode(code);
            const signedIn = await session();
            const row = await request(`/rest/v1/rpc/${DATABASE.lookup}`, signedIn.access_token, "POST", {code});
            if (row === null) return null;
            if (typeof row !== "object" || !("user_code" in row) || !("interests" in row)) throw new Error("Unexpected matching profile from Supabase.");
            if (readUserCode(row.user_code) !== code) throw new Error("The returned profile belongs to a different user.");
            return {user_code: code,interests: readInterests(row.interests)};
        },
        async saveMyInterests(interests, shareForMatching) {
            const tags = readInterests(interests);
            if (typeof shareForMatching !== "boolean") throw new Error("Choose whether to share your interests for matching.");
            const signedIn = await session();
            await request(`/rest/v1/${DATABASE.interests}?on_conflict=owner_id`, signedIn.access_token, "POST",
                {owner_id: signedIn.user.id,interests: tags,share_for_matching: shareForMatching}, "resolution=merge-duplicates,return=minimal");
        },
        async normalize(labels) {
            const checked = readLabels(labels);
            if (!checked.length) return [];
            const signedIn = await session();
            const data = await request(`/functions/v1/${DATABASE.normalizer}`, signedIn.access_token, "POST", {labels: checked});
            if (!data || typeof data !== "object" || !("interests" in data)) throw new Error("The normalizer did not return interests.");
            return readInterests(data.interests);
        }
    };
}
