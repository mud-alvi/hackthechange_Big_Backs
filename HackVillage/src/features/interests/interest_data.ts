import type {Interest} from "./types";

//A technical safety limit, not a list of available interests. Change it here.
export const MAX_INTERESTS = 100;
export const MAX_LABEL_LENGTH = 100;

export function readUserCode(value: unknown): string {
    if (typeof value !== "string" || !/^[0-9]{6}$/.test(value.trim())) {
        throw new Error("A user code must contain exactly six digits, for example 001234.");
    }
    return value.trim();
}

export function readLabels(value: unknown): string[] {
    if (!Array.isArray(value) || value.length > MAX_INTERESTS) {
        throw new Error(`Enter up to ${MAX_INTERESTS} interests.`);
    }
    const labels: string[] = [];
    for (const label of value) {
        if (typeof label !== "string" || !label.trim() || label.length > MAX_LABEL_LENGTH) {
            throw new Error("Each interest needs 1 to 100 characters.");
        }
        labels.push(label.trim());
    }
    return labels;
}

export function readInterests(value: unknown): Interest[] {
    if (!Array.isArray(value) || value.length > MAX_INTERESTS) {
        throw new Error(`A profile can have up to ${MAX_INTERESTS} interests.`);
    }
    const result: Interest[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (!item || typeof item !== "object") throw new Error("An interest must contain matching tags.");
        const cleaned: Record<string, string> = {};
        for (const field of ["label", "standard_id", "category", "subcategory"]) {
            const text = item[field];
            if (typeof text !== "string" || text.length > 200) throw new Error(`Invalid ${field} in interest.`);
            cleaned[field] = field === "label" ? text : text.trim().toLowerCase();
        }
        if (!cleaned.label.trim() || cleaned.label.length > MAX_LABEL_LENGTH || !cleaned.standard_id) {
            throw new Error("Each interest needs a label and standard_id.");
        }
        if (cleaned.subcategory && !cleaned.category) throw new Error("A subcategory needs a category.");
        if (!seen.has(cleaned.standard_id)) {
            seen.add(cleaned.standard_id);
            result.push({label: cleaned.label,standard_id: cleaned.standard_id,category: cleaned.category,subcategory: cleaned.subcategory});
        }
    }
    return result;
}

export function exactTextInterests(value: unknown): Interest[] {
    //Offline fallback only. It does not understand synonyms or guess groups.
    const tags = readLabels(value).map(label => ({label,standard_id: "text:" + label.normalize("NFKC").toLowerCase().replace(/\s+/g," "),category: "",subcategory: ""}));
    return readInterests(tags);
}
