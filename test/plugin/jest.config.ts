import { defineConfig } from "@isentinel/jest-roblox";

export default defineConfig({
	extends: "../../jest.shared.ts",
	test: {
		projects: [
			{
				test: {
					displayName: { color: "blue", name: "plugin" },
					include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
					mockDataModel: true,
					outDir: "out",
				},
			},
		],
	},
});
