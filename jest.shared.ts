import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	backend: "studio-cli",
	gameOutput: "game-output.log",
	jestPath: "ReplicatedStorage/rbxts_include/node_modules/@rbxts/jest/src",
	outputFile: "jest-output.log",
	placeFile: "test.rbxl",
	rojoProject: "default.project.json",
	timeout: 300000,
	test: {
		clearMocks: true,
		coveragePathIgnorePatterns: ["**/test/**", "**/index.ts"],
		setupFiles: ["@lisachandra/test/out/setup"],
		testTimeout: 5000,
	},
});
