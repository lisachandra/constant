import { configureAutomaticConstantReplication, configureConstant } from "@lisachandra/constant";

configureAutomaticConstantReplication({
	canEdit: () => true,
});

configureConstant("src/server/constants.json", import("./constants.json").expect() as never);

import("./demo").expect();
