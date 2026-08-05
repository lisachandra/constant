import {
	type ConstantDefinition,
	ConstantStore,
	type EditorSearchInput,
	type EditorSearchResult,
	normalizeSearchQuery,
	rankEditorGroups,
} from "@lisachandra/constant";
import { describe, expect, it } from "@rbxts/jest-globals";

interface TestEditor {
	readonly path: string;
	readonly store: ConstantStore;
}

function makeEditor(path: string, entries: Array<[string, number]>): TestEditor {
	let store = new ConstantStore("client", {}, "src/client/constants.json", path);
	for (const [name, value] of entries) {
		store = store.add(name, value);
	}

	return { path, store };
}

function requireGroup<T extends EditorSearchInput>(
	groups: Array<EditorSearchResult<T>>,
): EditorSearchResult<T> {
	const group = groups[0];
	if (group === undefined) {
		error("expected at least one editor group");
	}

	return group;
}

function requireName(pair: undefined | [string, ConstantDefinition]): string {
	if (pair === undefined) {
		error("expected a definition pair");
	}

	return pair[0];
}

function groupLabels<T extends EditorSearchInput>(
	groups: Array<EditorSearchResult<T>>,
): Array<string> {
	return groups.map((group) => group.editor.path.gsub("^game%.", "")[0]);
}

describe("search query normalization", () => {
	it("should trailing whitespace in the query still matches", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.PlayerConfig", [
				["WALK_SPEED", 16],
				["MAX_HEALTH", 100],
			]),
		];
		const groups = rankEditorGroups(editors, "speed ");

		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	it("should leading whitespace in the query still matches", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.PlayerConfig", [
				["WALK_SPEED", 16],
				["MAX_HEALTH", 100],
			]),
		];
		const groups = rankEditorGroups(editors, " walk");

		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	it("should whitespace-only query behaves like an empty query", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.PlayerConfig", [
				["WALK_SPEED", 16],
				["MAX_HEALTH", 100],
			]),
		];
		const emptyGroups = rankEditorGroups(editors, "");
		const spaceGroups = rankEditorGroups(editors, "   ");

		expect(spaceGroups.size()).toBe(emptyGroups.size());
		expect(requireGroup(spaceGroups).definitions.size()).toBe(2);
	});

	it("should normalizeSearchQuery trims and collapses whitespace-only input", () => {
		expect.hasAssertions();

		expect(normalizeSearchQuery("  walk speed  ")).toBe("walk speed");
		expect(normalizeSearchQuery(" \t\n ")).toBe("");
	});
});

describe("fuzzy search non-ASCII names", () => {
	it("should non-ASCII constant names match accent-stripped ASCII queries", () => {
		expect.hasAssertions();

		const editors = [makeEditor("game.PlayerConfig", [["Vitória", 16]])];
		const groups = rankEditorGroups(editors, "vitoria");

		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("Vitória");
	});

	it("should non-ASCII constant names match non-ASCII queries", () => {
		expect.hasAssertions();

		const editors = [makeEditor("game.PlayerConfig", [["Vitória", 16]])];
		const groups = rankEditorGroups(editors, "vító");

		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("Vitória");
	});
});

describe("fuzzy search ordering", () => {
	it("should higher-scoring definitions rank first", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.PlayerConfig", [
				["MaxHealth", 100],
				["WalkSpeed", 16],
			]),
		];
		const groups = rankEditorGroups(editors, "walkspeed");

		expect(groups.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WalkSpeed");
	});

	it("should equal-score definitions are ordered deterministically by name", () => {
		expect.hasAssertions();

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

	it("should equal-score editor groups are ordered deterministically by script label", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.ConfigDelta", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigAlpha", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigCharlie", [["MAX_HEALTH", 100]]),
			makeEditor("game.ConfigBravo", [["MAX_HEALTH", 100]]),
		];
		const groups = rankEditorGroups(editors, "config");

		expect(groupLabels(groups)).toEqual([
			"ConfigAlpha",
			"ConfigBravo",
			"ConfigCharlie",
			"ConfigDelta",
		]);
	});
});

describe("editor group semantics", () => {
	it("should constant matches narrow the group to matching definitions", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.PlayerConfig", [
				["WALK_SPEED", 16],
				["MAX_HEALTH", 100],
			]),
		];
		const groups = rankEditorGroups(editors, "walk");

		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(1);
		expect(requireName(requireGroup(groups).definitions[0])).toBe("WALK_SPEED");
	});

	it("should definition-match groups rank above script-label-only groups", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.WalkthroughGuide", [
				["MAX_HEALTH", 100],
				["JUMP_POWER", 50],
			]),
			makeEditor("game.PlayerConfig", [["WALK_SPEED", 16]]),
		];
		const groups = rankEditorGroups(editors, "walk");

		expect(groups.size()).toBe(2);
		expect(groupLabels(groups)).toEqual(["PlayerConfig", "WalkthroughGuide"]);
	});

	it("should script-label-only matches keep the script's constants visible", () => {
		expect.hasAssertions();

		const editors = [
			makeEditor("game.WalkthroughGuide", [
				["MAX_HEALTH", 100],
				["JUMP_POWER", 50],
			]),
		];
		const groups = rankEditorGroups(editors, "walk");

		expect(groups.size()).toBe(1);
		expect(requireGroup(groups).definitions.size()).toBe(2);
	});

	it("should non-matching queries return no groups", () => {
		expect.hasAssertions();

		const editors = [makeEditor("game.PlayerConfig", [["WALK_SPEED", 16]])];

		expect(rankEditorGroups(editors, "zzzz").size()).toBe(0);
	});
});
