import {
	configureAutomaticConstantReplication,
	configureConstant,
	type PersistedConstantFile,
} from "@lisachandra/constant";

configureAutomaticConstantReplication({
	canEdit: () => true,
});

configureConstant(
	"src/server/constants.json",
	import("./constants.json").expect() as unknown as PersistedConstantFile,
);

import("./demo").expect();
