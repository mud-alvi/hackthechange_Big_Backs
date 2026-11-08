import {readInterests} from "./interest_data";
import type {Interest, MatchResult} from "./types";

function pairPoints(a: Interest, b: Interest): number {
    if (a.standard_id === b.standard_id) return 100;
    //A narrow group only matches inside the same broad group.
    if (a.category && a.category === b.category) {
        if (a.subcategory && a.subcategory === b.subcategory) return 25;
        return 5;
    }
    return 0;
}

function bestAssignment(points: number[][]): number[] {
    //Hungarian assignment: find the best total without trying every combination.
    //Rows and columns represent interests. Empty padding means 'no partner'.
    //The cost is 100 minus the points, so the lowest cost gives the best match.
    const size = points.length;
    const rowPrice = Array(size + 1).fill(0);
    const columnPrice = Array(size + 1).fill(0);
    const rowForColumn = Array(size + 1).fill(0);
    const previousColumn = Array(size + 1).fill(0);

    for (let row = 1; row <= size; row++) {
        rowForColumn[0] = row;
        let column = 0;
        const costToReach = Array(size + 1).fill(Infinity);
        const visited = Array(size + 1).fill(false);
        do {
            visited[column] = true;
            const currentRow = rowForColumn[column];
            let smallestCost = Infinity;
            let nextColumn = 0;
            for (let candidate = 1; candidate <= size; candidate++) {
                if (visited[candidate]) continue;
                const cost = 100 - points[currentRow - 1][candidate - 1] - rowPrice[currentRow] - columnPrice[candidate];
                if (cost < costToReach[candidate]) {
                    costToReach[candidate] = cost;
                    previousColumn[candidate] = column;
                }
                if (costToReach[candidate] < smallestCost) {
                    smallestCost = costToReach[candidate];
                    nextColumn = candidate;
                }
            }
            for (let candidate = 0; candidate <= size; candidate++) {
                if (visited[candidate]) {
                    rowPrice[rowForColumn[candidate]] += smallestCost;
                    columnPrice[candidate] -= smallestCost;
                } else {
                    costToReach[candidate] -= smallestCost;
                }
            }
            column = nextColumn;
        } while (rowForColumn[column] !== 0);

        //Follow the chosen path back and update its pairings.
        do {
            const previous = previousColumn[column];
            rowForColumn[column] = rowForColumn[previous];
            column = previous;
        } while (column !== 0);
    }
    const columns = Array(size).fill(-1);
    for (let column = 1; column <= size; column++) columns[rowForColumn[column] - 1] = column - 1;
    return columns;
}

export function calculateInterestMatch(inputA: unknown, inputB: unknown): MatchResult {
    const a = readInterests(inputA);
    const b = readInterests(inputB);
    if (!a.length || !b.length) {
        //Missing data is different from two complete profiles that do not match.
        return {score: null, matched_pairs: [], unmatched_a: a.map(item => item.label), unmatched_b: b.map(item => item.label)};
    }
    const size = Math.max(a.length, b.length);
    const points: number[][] = [];
    for (let row = 0; row < size; row++) {
        points.push([]);
        for (let column = 0; column < size; column++) {
            points[row].push(row < a.length && column < b.length ? pairPoints(a[row], b[column]) : 0);
        }
    }
    const columns = bestAssignment(points);
    const matched: MatchResult["matched_pairs"] = [];
    const usedA = new Set<number>();
    const usedB = new Set<number>();
    let totalPoints = 0;
    for (let row = 0; row < a.length; row++) {
        const column = columns[row];
        if (column >= b.length || points[row][column] === 0) continue;
        totalPoints += points[row][column];
        usedA.add(row);
        usedB.add(column);
        matched.push({label_a: a[row].label,label_b: b[column].label,similarity: points[row][column] / 100});
    }
    //Each pair covers two interests. Round the final percentage to one decimal.
    const score = Math.round((2 * totalPoints / (a.length + b.length)) * 10) / 10;
    return {score, matched_pairs: matched,
        unmatched_a: a.filter((_, index) => !usedA.has(index)).map(item => item.label),
        unmatched_b: b.filter((_, index) => !usedB.has(index)).map(item => item.label)};
}
