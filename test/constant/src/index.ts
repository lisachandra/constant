import { createBindableEventSink, Constant } from "../../../packages/constant/src";

const persistSink = createBindableEventSink();

const clientConstants = new Constant("client")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0));

const serverConstants = new Constant("server")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("SPAWN_OFFSET", new Vector3(0, 5, 0));

clientConstants.mountEditor({
	title: "Client Constants",
	persistMode: "manual",
	onPersist: (payload) => persistSink.publish(payload),
});

serverConstants.mountEditor({
	title: "Server Constants",
	persistMode: "manual",
	onPersist: (payload) => persistSink.publish(payload),
});

export const clientBuiltConstants = clientConstants.build();
export const serverBuiltConstants = serverConstants.build();
