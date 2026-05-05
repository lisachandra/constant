import { Constant } from "@lisachandra/constant";

export const constants = new Constant()
	.add("ANNOUNCEMENT", "Secondary ready")
	.add("PART_COLOR", Color3.fromRGB(255, 170, 0))
	.add("SPAWN_OFFSET", new Vector3(12, 4, 0))
	.add("PART_SIZE", 6);
