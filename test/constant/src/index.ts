import { Constant } from "@lisachandra/constant";
import { RunService } from "@rbxts/services";

const clientConstants = new Constant("src/client/constants.json")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0));

const serverConstants = new Constant("src/server/constants.json")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("SPAWN_OFFSET", new Vector3(0, 5, 0));

if (RunService.IsStudio()) {
	clientConstants.mountEditor({
		title: "Client Constants",
		persistMode: "manual",
	});

	serverConstants.mountEditor({
		title: "Server Constants",
		persistMode: "manual",
	});
}

export const clientBuiltConstants = clientConstants.build();
export const serverBuiltConstants = serverConstants.build();
