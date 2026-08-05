/*
 * We do this since our rbxts project is built as 'package' to maintain test portability, instead of 'model'
 * If we built as package it would use TS = _G[script], but this isn't available in plugin environments since nothing required it (server script)
 * If we built as model, it would use TS = require(includePath), we would no longer be able to test in two different packages since this would use it's own runtime, resulting in duplicated runtimes.
 */
if (script.FindFirstAncestorWhichIsA("Plugin") && _G.__TEST__ !== true) {
	const parent = script.Parent;
	const typesFolder = parent?.Parent?.WaitForChild<Folder>("types");
	if (!parent || !typesFolder) {
		error("Constant plugin bootstrap requires a script parent chain");
	}

	const runtime = require(
		typesFolder.WaitForChild<Folder>("include").WaitForChild<ModuleScript>("RuntimeLib"),
	) as typeof import("@lisachandra/types/out/include/RuntimeLib");
	(runtime.import(script, parent as ModuleScript, "main") as typeof import("./main"))(plugin);
}
