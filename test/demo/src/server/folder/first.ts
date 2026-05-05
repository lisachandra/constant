import { Constant } from "@lisachandra/constant";

export const constants = new Constant()
	.add("SPAWN_OFFSET", new Vector3(0, 8, 0))
	.add("PART_COLOR", Color3.fromRGB(0, 255, 0))
	.add("PART_SIZE", 10)
	.add("ANNOUNCEMENT", "Server ready");
