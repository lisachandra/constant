import { Constant } from "@lisachandra/constant";
import { Players, RunService } from "@rbxts/services";
import { LABEL_GUI_NAME, roundTenth } from "../shared/demo-state";

const constants = new Constant("src/client/constants.json")
	.add("WALK_SPEED", 16)
	.add("DEBUG_RAYCASTS", false)
	.add("THEME_COLOR", Color3.fromRGB(255, 0, 0))
	.add("STATUS_TEXT", "Client ready");
const c = constants.build();

function applyCharacterDemoState(character: Model): void {
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	const head = character.FindFirstChild("Head");
	if (!humanoid || !head || !head.IsA("BasePart")) return;

	humanoid.WalkSpeed = c.WALK_SPEED;

	let billboard = head.FindFirstChild<BillboardGui>(LABEL_GUI_NAME);
	if (!billboard || !billboard.IsA("BillboardGui")) {
		billboard = new Instance("BillboardGui");
		billboard.Name = LABEL_GUI_NAME;
		billboard.Size = UDim2.fromOffset(220, 56);
		billboard.StudsOffsetWorldSpace = new Vector3(0, 3, 0);
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

	label.BackgroundColor3 = c.THEME_COLOR;
	label.Text = `${c.STATUS_TEXT}\nWalkSpeed=${roundTenth(c.WALK_SPEED)}`;
	head.Color = c.DEBUG_RAYCASTS ? c.THEME_COLOR : Color3.fromRGB(255, 204, 153);
}

function hookPlayer(player: Player): void {
	const applyCurrentCharacter = (character: Model) => applyCharacterDemoState(character);

	player.CharacterAdded.Connect(applyCurrentCharacter);
	if (player.Character) {
		applyCurrentCharacter(player.Character);
	}
}

for (const player of Players.GetPlayers()) {
	hookPlayer(player);
}
Players.PlayerAdded.Connect(hookPlayer);

const refreshLocalCharacter = () => {
	const player = Players.LocalPlayer;
	if (player?.Character) {
		applyCharacterDemoState(player.Character);
	}
};

constants.subscribe(() => {
	refreshLocalCharacter();
});

refreshLocalCharacter();
