import { describe, expect, test } from "@rbxts/jest-globals";
import {
	ConstantStore,
	normalizeSearchQuery,
	rankEditorGroups,
	type ConstantDefinition,
	type EditorSearchInput,
	type EditorSearchResult,
} from "@lisachandra/constant";

interface TestEditor {
	readonly path: string;
	readonly store: ConstantStore<object>;
}

function makeEditor(path: string, entries: Array<[string, number]>): TestEditor {
	let store = new ConstantStore<object>("client", {}, "src/client/constants.json", path);
	for (const [name, value] of entries) {
		store = store.add(name, value);
	}
	return { path, store };
}

function requireGroup<T extends EditorSearchInput>(
	groups: Array<EditorSearchResult<T>>,
): EditorSearchResult<T> {
	const group = groups[0];
	if (group === undefined) error("expected at least one editor group");
	return group;
}

function requireName(pair: [string, ConstantDefinition] | undefined): string {
	if (pair === undefined) error("expected a definition pair");
	return pair[0];
}

function groupLabels<T extends EditorSearchInput>(groups: Array<EditorSearchResult<T>>): Array<string> {
	return groups.map((group) => group.editor.path.gsub("^game%.", "")[0]);
}

describe("search query normalization", () => {
	test("trailing whitespace in the query still matches", () => {
		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16], ["MAX_HEALTH", 100]])];
		const groups = rankEditorGroups(editors, "speed ");
		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	test("leading whitespace in the query still matches", () => {
		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16], ["MAX_HEALTH", 100]])];
		const groups = rankEditorGroups(editors, " walk");
		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	test("whitespace-only query behaves like an empty query", () => {
		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16], ["MAX_HEALTH", 100]])];
		const emptyGroups = rankEditorGroups(editors, "");
		const spaceGroups = rankEditorGroups(editors, "   ");
		expect(spaceGroups.size()).toBe(emptyGroups.size());
		expect(requireGroup(spaceGroups).definitions.size()).toBe(2);
	});

	test("normalizeSearchQuery trims and collapses whitespace-only input", () => {
		expect(normalizeSearchQuery("  walk speed  ")).toBe("walk speed");
		expect(normalizeSearchQuery(" \t\n ")).toBe("");
	});
});

describe("fuzzy search non-ASCII names", () => {
	test("non-ASCII constant names match accent-stripped ASCII queries", () => {
		const editors = [makeEditor("game.PlayerConfig", [["Vitória", 16]])];
		const groups = rankEditorGroups(editors, "vitoria");
		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("Vitória");
	});

	test("non-ASCII constant names match non-ASCII queries", () => {
		const editors = [makeEditor("game.PlayerConfig", [["Vitória", 16]])];
		const groups = rankEditorGroups(editors, "vító");
		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("Vitória");
	});
});

describe("fuzzy search ordering", () => {
	test("higher-scoring definitions rank first", () => {
		const editors = [makeEditor("game.PlayerConfig", [["MaxHealth", 100], ["WalkSpeed", 16]])];
		const groups = rankEditorGroups(editors, "walkspeed");
		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WalkSpeed");
	});

	test("equal-score definitions are ordered deterministically by name", () => {
		const editors = [
			makeEditor("game.PlayerConfig", [
				["DeltaSpeed", 1],
				["AlphaSpeed", 2],
				["CharlieSpeed", 3],
				["BravoSpeed", 4],
			]),
		];
		const groups = rankEditorGroups(editors, "speed");
		const names = requireGroup(groups).definitions.map(([name]) => name);
		expect(names).toEqual(["AlphaSpeed", "BravoSpeed", "CharlieSpeed", "DeltaSpeed"]);
	});

	test("equal-score editor groups are ordered deterministically by script label", () => {
		const editors = [
			makeEditor("game.ConfigDelta", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigAlpha", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigCharlie", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigBravo", [["MAX_HEALTH", 100]]),
		];
		const groups = rankEditorGroups(editors, "config");
		expect(groupLabels(groups)).toEqual(["ConfigAlpha", "ConfigBravo", "ConfigCharlie", "ConfigDelta"]);
	});
});

describe("editor group semantics", () => {
	test("constant matches narrow the group to matching definitions", () => {
		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16], ["MAX_HEALTH", 100]])];
		const groups = rankEditorGroups(editors, "walk");
		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	test("definition-match groups rank above script-label-only groups", () => {
		const editors = [
			makeEditor("game.WalkthroughGuide", [["MAX_HEALTH", 100], ["JUMP_POWER", 50]]),
			makeEditor("game.PlayerConfig", [["WALK_SPEED", 16]]),
		];
		const groups = rankEditorGroups(editors, "walk");
		expect(groups.size()).toBe(2);
		expect(groupLabels(groups)).toEqual(["PlayerConfig", "WalkthroughGuide"]);
	});

	test("script-label-only matches keep the script's constants visible", () => {
		const editors = [makeEditor("game.WalkthroughGuide", [["MAX_HEALTH", 100], ["JUMP_POWER", 50]])];
		const groups = rankEditorGroups(editors, "walk");
		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(2);
	});

	test("non-matching queries return no groups", () => {
		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16]])];
		expect(rankEditorGroups(editors, "zzzz").size()).toBe(0);
	});
});
