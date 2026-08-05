const config = {
	agents: {
		default: "dirac",
		enabled: ["dirac", "pi"],
		models: { dirac: "dp/deepseek-v4-flash" },
	},
	baseBranch: "main",
	dir: ".sandcastle",
	effort: "max",
	issueCommand: "gh issue view {issue}",
	labels: { readyForAgent: "ready-for-agent" },
	reviewMarker: "Sandcastle-Review",
	setupCommands: ["pnpm setup"],
	symlinks: [
		{ path: "creator-docs", target: "creator-docs" },
		{ path: ".diracrules", target: ".agents" },
	],
};

export default config;
