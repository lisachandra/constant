import { configureConstant } from "@lisachandra/constant";

configureConstant("src/client/constants.json", import("./constants.json").expect() as never, {
	keyCode: Enum.KeyCode.F8,
	title: "Client Constants",
});

import("./demo").expect();
