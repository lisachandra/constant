import {
	configureAutomaticConstantReplication,
	Constant,
} from "@lisachandra/constant";
import { Workspace } from "@rbxts/services";
import { LABEL_GUI_NAME, MARKER_PART_NAME, roundTenth } from "../shared/demo-state";

configureAutomaticConstantReplication({
	canEdit: () => true,
});

const constants = new Constant("src/server/constants.json")
	.add("SPAWN_OFFSET", new Vector3(0, 8, 0))
	.add("PART_COLOR", Color3.fromRGB(0, 255, 0))
	.add("PART_SIZE", 10)
	.add("ANNOUNCEMENT", "Server ready");
const c = constants.build();

function ensureMarkerPart(): Part {
	let marker = Workspace.FindFirstChild<Part>(MARKER_PART_NAME);
	if (!marker || !marker.IsA("Part")) {
		marker = new Instance("Part");
		marker.Name = MARKER_PART_NAME;
		marker.Anchored = true;
		marker.CanCollide = true;
		marker.Material = Enum.Material.Neon;
		marker.TopSurface = Enum.SurfaceType.Smooth;
		marker.BottomSurface = Enum.SurfaceType.Smooth;
		marker.Parent = Workspace;
	}

	return marker;
}

function ensureBillboard(part: BasePart): TextLabel {
	let billboard = part.FindFirstChild<BillboardGui>(LABEL_GUI_NAME);
	if (!billboard || !billboard.IsA("BillboardGui")) {
		billboard = new Instance("BillboardGui");
		billboard.Name = LABEL_GUI_NAME;
		billboard.Size = UDim2.fromOffset(260, 80);
		billboard.StudsOffsetWorldSpace = new Vector3(0, 6, 0);
		billboard.AlwaysOnTop = true;
		billboard.Parent = part;
	}

	let label = billboard.FindFirstChild<TextLabel>("Label");
	if (!label || !label.IsA("TextLabel")) {
		label = new Instance("TextLabel");
		label.Name = "Label";
		label.Size = UDim2.fromScale(1, 1);
		label.BackgroundTransparency = 0.2;
		label.BackgroundColor3 = Color3.fromRGB(25, 25, 25);
		label.TextColor3 = Color3.fromRGB(255, 255, 255);
		label.TextWrapped = true;
		label.TextScaled = true;
		label.Font = Enum.Font.BuilderSansBold;
		label.Parent = billboard;
	}

	return label;
}

function applyServerDemoState(): void {
	const marker = ensureMarkerPart();
	const label = ensureBillboard(marker);
	const size = math.max(2, c.PART_SIZE);

	marker.Size = new Vector3(size, size, size);
	marker.Position = new Vector3(0, size * 0.5, 0).add(c.SPAWN_OFFSET);
	marker.Color = c.PART_COLOR;
	label.Text = `${c.ANNOUNCEMENT}
Size=${roundTenth(size)}`;
}

constants.subscribe(() => {
	applyServerDemoState();
});

applyServerDemoState();
