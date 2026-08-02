import type { ConstantDefinition } from "./types";

/**
 * Minimal editor shape the search module ranks.
 * Anything with a script path and a definitions map can be searched.
 */
export interface EditorSearchInput {
	readonly path: string;
	readonly store: {
		getDefinitions(): ReadonlyMap<string, ConstantDefinition>;
	};
}

/**
 * One editor group after ranking: the editor, the definitions to render,
 * and the score that placed it.
 */
export interface EditorSearchResult<T extends EditorSearchInput> {
	readonly editor: T;
	readonly definitions: ReadonlyArray<[string, ConstantDefinition]>;
	readonly score: number;
	readonly hasDefinitionMatches: boolean;
}

// Accent folding table: accented Latin letters map to their ASCII base.
// Both cases are folded before `string.lower` because Luau only lowercases ASCII.
const ACCENT_FOLD: Record<string, string> = {
	["Á"]: "A", ["À"]: "A", ["Â"]: "A", ["Ä"]: "A", ["Ã"]: "A", ["Å"]: "A", ["Ā"]: "A", ["Ă"]: "A", ["Ą"]: "A",
	["á"]: "a", ["à"]: "a", ["â"]: "a", ["ä"]: "a", ["ã"]: "a", ["å"]: "a", ["ā"]: "a", ["ă"]: "a", ["ą"]: "a",
	["É"]: "E", ["È"]: "E", ["Ê"]: "E", ["Ë"]: "E", ["Ē"]: "E", ["Ĕ"]: "E", ["Ė"]: "E", ["Ę"]: "E", ["Ě"]: "E",
	["é"]: "e", ["è"]: "e", ["ê"]: "e", ["ë"]: "e", ["ē"]: "e", ["ĕ"]: "e", ["ė"]: "e", ["ę"]: "e", ["ě"]: "e",
	["Í"]: "I", ["Ì"]: "I", ["Î"]: "I", ["Ï"]: "I", ["Ī"]: "I", ["Ĭ"]: "I", ["Į"]: "I",
	["í"]: "i", ["ì"]: "i", ["î"]: "i", ["ï"]: "i", ["ī"]: "i", ["ĭ"]: "i", ["į"]: "i",
	["Ó"]: "O", ["Ò"]: "O", ["Ô"]: "O", ["Õ"]: "O", ["Ö"]: "O", ["Ø"]: "O", ["Ō"]: "O", ["Ŏ"]: "O", ["Ő"]: "O",
	["ó"]: "o", ["ò"]: "o", ["ô"]: "o", ["õ"]: "o", ["ö"]: "o", ["ø"]: "o", ["ō"]: "o", ["ŏ"]: "o", ["ő"]: "o",
	["Ú"]: "U", ["Ù"]: "U", ["Û"]: "U", ["Ü"]: "U", ["Ū"]: "U", ["Ŭ"]: "U", ["Ű"]: "U", ["Ů"]: "U",
	["ú"]: "u", ["ù"]: "u", ["û"]: "u", ["ü"]: "u", ["ū"]: "u", ["ŭ"]: "u", ["ű"]: "u", ["ů"]: "u",
	["Ý"]: "Y", ["Ÿ"]: "Y", ["ý"]: "y", ["ÿ"]: "y",
	["Ç"]: "C", ["Ć"]: "C", ["Č"]: "C", ["ç"]: "c", ["ć"]: "c", ["č"]: "c",
	["Ñ"]: "N", ["Ń"]: "N", ["Ň"]: "N", ["ñ"]: "n", ["ń"]: "n", ["ň"]: "n",
	["Š"]: "S", ["š"]: "s", ["Ž"]: "Z", ["ž"]: "z",
};

/**
 * Folds a string for comparison: accent-stripped, then ASCII-lowercased.
 * @param input - String to fold.
 * @returns Folded string safe for fuzzy scoring.
 */
function foldForSearch(input: string): string {
	let folded = "";
	for (const [, codepoint] of utf8.codes(input)) {
		const char = utf8.char(codepoint);
		folded += ACCENT_FOLD[char] ?? char;
	}
	return folded.lower();
}

/**
 * Converts a string into folded Unicode code points for scoring.
 * @param input - String to convert.
 * @returns Array of folded code points.
 */
function toFoldedCodes(input: string): Array<number> {
	const codes = new Array<number>();
	for (const [, codepoint] of utf8.codes(foldForSearch(input))) {
		codes.push(codepoint);
	}
	return codes;
}

/**
 * Strips a leading `game.` prefix from an editor source path for display.
 * @param path - Full source path, e.g. `game.ReplicatedStorage.Config`.
 * @returns Path without the `game.` prefix.
 */
export function getEditorSourceLabel(path: string): string {
	return path.gsub("^game%.", "")[0];
}

/**
 * Normalizes a search query by trimming surrounding whitespace.
 * @param query - Raw query from the search input.
 * @returns Trimmed query; whitespace-only input becomes `""`.
 */
export function normalizeSearchQuery(query: string): string {
	return query.gsub("^%s+", "")[0].gsub("%s+$", "")[0];
}

/**
 * Scores how well a query matches a term as an ordered subsequence.
 * Matching is case- and accent-insensitive and operates on code points, so
 * non-ASCII names match correctly. Consecutive matches score higher; a query
 * character that cannot be matched returns `0`.
 * @param term - Candidate string (constant name or editor label).
 * @param query - Normalized search query.
 * @returns Positive match score, or `0` when the query does not match.
 */
function scoreFuzzySearch(term: string, query: string): number {
	const termCodes = toFoldedCodes(term);
	const queryCodes = toFoldedCodes(query);
	if (queryCodes.size() === 0) return 0;

	let score = 0;
	let termIndex = 0;
	let previousMatchedIndex = -2;
	for (const queryCode of queryCodes) {
		let found = false;
		while (termIndex < termCodes.size()) {
			const termCode = termCodes[termIndex];
			if (termCode === queryCode) {
				score += 1;
				if (previousMatchedIndex === termIndex - 1) {
					score += 2;
				}
				previousMatchedIndex = termIndex;
				termIndex += 1;
				found = true;
				break;
			}
			termIndex += 1;
		}
		if (!found) return 0;
	}
	return score;
}

/**
 * Compares two names for deterministic ordering: case-insensitive, then raw.
 * @param left - First name.
 * @param right - Second name.
 * @returns `true` when `left` sorts before `right`.
 */
function compareNames(left: string, right: string): boolean {
	const leftLower = left.lower();
	const rightLower = right.lower();
	if (leftLower !== rightLower) return leftLower < rightLower;
	return left < right;
}

/**
 * Returns all definitions of an editor sorted deterministically by name.
 * @param editor - Editor whose definitions to sort.
 * @returns Name/definition pairs in name order.
 */
function getSortedDefinitions<T extends EditorSearchInput>(editor: T): Array<[string, ConstantDefinition]> {
	const definitions = new Array<[string, ConstantDefinition]>();
	for (const [name, definition] of editor.store.getDefinitions()) {
		definitions.push([name, definition]);
	}
	definitions.sort((left, right) => compareNames(left[0], right[0]));
	return definitions;
}

/**
 * Returns matching definitions of an editor ranked by score, then by name.
 * @param editor - Editor whose definitions to rank.
 * @param query - Normalized search query.
 * @returns Ranked score/name/definition triples; empty when nothing matches.
 */
function getRankedDefinitions<T extends EditorSearchInput>(
	editor: T,
	query: string,
): Array<[number, string, ConstantDefinition]> {
	const ranked = new Array<[number, string, ConstantDefinition]>();
	for (const [name, definition] of editor.store.getDefinitions()) {
		const score = scoreFuzzySearch(name, query);
		if (score <= 0) continue;
		ranked.push([score, name, definition]);
	}
	ranked.sort((left, right) => {
		if (left[0] !== right[0]) return left[0] > right[0];
		return compareNames(left[1], right[1]);
	});
	return ranked;
}

/**
 * Ranks editors and their definitions for a search query.
 * Whitespace-only queries behave like an empty query (everything shows).
 * Groups with definition matches rank above script-label-only matches; ties
 * are broken by score, then by script label, so ordering never flickers.
 * @param editors - Editors to search across.
 * @param query - Raw query; trimmed before use.
 * @returns Renderable editor groups in display order.
 * @template T - Concrete editor type; must satisfy {@link EditorSearchInput}.
 */
export function rankEditorGroups<T extends EditorSearchInput>(
	editors: ReadonlyArray<T>,
	query: string,
): Array<EditorSearchResult<T>> {
	const normalizedQuery = normalizeSearchQuery(query);

	if (normalizedQuery === "") {
		const groups = new Array<EditorSearchResult<T>>();
		for (const editor of editors) {
			groups.push({
				editor,
				definitions: getSortedDefinitions(editor),
				score: 0,
				hasDefinitionMatches: false,
			});
		}
		groups.sort((left, right) => compareNames(getEditorSourceLabel(left.editor.path), getEditorSourceLabel(right.editor.path)));
		return groups;
	}

	const groups = new Array<EditorSearchResult<T>>();
	for (const editor of editors) {
		const editorScore = scoreFuzzySearch(getEditorSourceLabel(editor.path), normalizedQuery);
		const rankedDefinitions = getRankedDefinitions(editor, normalizedQuery);
		const hasDefinitionMatches = rankedDefinitions.size() > 0;
		const firstRanked = rankedDefinitions[0];
		const bestDefinitionScore = firstRanked !== undefined ? firstRanked[0] : 0;
		const score = math.max(editorScore, bestDefinitionScore);
		if (score <= 0) continue;

		groups.push({
			editor,
			definitions: hasDefinitionMatches
				? rankedDefinitions.map(([, name, definition]) => [name, definition])
				: getSortedDefinitions(editor),
			score,
			hasDefinitionMatches,
		});
	}

	groups.sort((left, right) => {
		if (left.hasDefinitionMatches !== right.hasDefinitionMatches) return left.hasDefinitionMatches;
		if (left.score !== right.score) return left.score > right.score;
		return compareNames(getEditorSourceLabel(left.editor.path), getEditorSourceLabel(right.editor.path));
	});
	return groups;
}
