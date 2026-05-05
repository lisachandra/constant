// We do this since our rbxts project is built as 'package' to maintain test portability, instead of 'model'
// If we built as package it would use TS = _G[script], but this isn't available in plugin environments since nothing required it (server script)
// If we built as model, it would use TS = require(includePath), we would no longer be able to test in two different packages since this would use it's own runtime, resulting in duplicated runtimes.
if (script.FindFirstAncestorWhichIsA("Plugin") && !_G.__TEST__) {
	const runtime: typeof import("@lisachandra/types/out/include/RuntimeLib") =
		require(
			script.Parent!.Parent!
				.WaitForChild<Folder>("types")
				.WaitForChild<Folder>("include")
				.WaitForChild<ModuleScript>("RuntimeLib")
			) as any
	(runtime.import(script, script.Parent as ModuleScript, "main") as typeof import("./main"))(plugin)
}
