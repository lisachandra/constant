import { Players, RunService } from "@rbxts/services";
import { constants as firstConstants } from "./folder/first";
import { constants as secondConstants } from "./folder/second";
import { LABEL_GUI_NAME, roundTenth } from "../shared/demo-state";

const first = firstConstants.build();
const second = secondConstants.build();

function applyCharacterDemoState(character: Model): void {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	const head = character.FindFirstChild("Head");
	if (!humanoid || !head || !head.IsA("BasePart")) return;

	humanoid.WalkSpeed = first.WALK_SPEED;

	let billboard = head.FindFirstChild<BillboardGui>(LABEL_GUI_NAME);
	if (!billboard || !billboard.IsA("BillboardGui")) {
		billboard = new Instance("BillboardGui");
		billboard.Name = LABEL_GUI_NAME;
		billboard.Size = UDim2.fromOffset(220, 96);
		billboard.AlwaysOnTop = true;
		billboard.Parent = head;
	}

	let label = billboard.FindFirstChild<TextLabel>("Label");
	if (!label || !label.IsA("TextLabel")) {
		label = new Instance("TextLabel");
		label.Name = "Label";
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 0.2;
		label.TextColor3 = Color3.fromRGB(255, 255, 255);
		label.TextWrapped = true;
		label.TextScaled = true;
		label.Font = Enum.Font.BuilderSans;
		label.Parent = billboard;
	}

	billboard.StudsOffsetWorldSpace = new Vector3(0, second.LABEL_OFFSET_Y, 0);
	label.BackgroundColor3 = second.THEME_COLOR;
	label.Text = `First: ${first.STATUS_TEXT} | Speed=${roundTenth(first.WALK_SPEED)} | Debug=${tostring(first.DEBUG_RAYCASTS)}\nSecond: ${second.STATUS_TEXT} | Speed=${roundTenth(second.WALK_SPEED)} | Debug=${tostring(second.DEBUG_RAYCASTS)}`;
	head.Color = second.DEBUG_RAYCASTS ? second.THEME_COLOR : Color3.fromRGB(255, 204, 153);
}

RunService.Heartbeat.Connect(() => {
	for (const player of Players.GetPlayers()) {
		if (player.Character) {
			applyCharacterDemoState(player.Character)
		}
	}
})
