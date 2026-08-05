import { configureConstant, type PersistedConstantFile } from "@lisachandra/constant";

configureConstant(
	"src/client/constants.json",
	import("./constants.json").expect() as unknown as PersistedConstantFile,
	{
		keyCode: Enum.KeyCode.F8,
		title: "Client Constants",
	},
);

import("./demo").expect();
