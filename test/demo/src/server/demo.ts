import { Workspace } from "@rbxts/services";
import { constants as firstConstants } from "./folder/first";
import { constants as secondConstants } from "./folder/second";
import { LABEL_GUI_NAME, MARKER_PART_NAME, roundTenth } from "../shared/demo-state";

const SECONDARY_MARKER_PART_NAME = "ConstantDemoMarkerSecondary";

const first = firstConstants.build();
const second = secondConstants.build();

function ensureMarkerPart(name: string): Part {
	let marker = Workspace.FindFirstChild<Part>(name);
	if (!marker || !marker.IsA("Part")) {
		marker = new Instance("Part");
		marker.Name = name;
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

function applyMarkerState(
	partName: string,
	labelPrefix: string,
	announcement: string,
	partSize: number,
	partColor: Color3,
	spawnOffset: Vector3,
): void {
	const marker = ensureMarkerPart(partName);
	const label = ensureBillboard(marker);
	const size = math.max(2, partSize);

	marker.Size = new Vector3(size, size, size);
	marker.Position = new Vector3(0, size * 0.5, 0).add(spawnOffset);
	marker.Color = partColor;
	label.Text = `${labelPrefix}: ${announcement}\nSize=${roundTenth(size)}\nOffset=${roundTenth(spawnOffset.X)}, ${roundTenth(spawnOffset.Y)}, ${roundTenth(spawnOffset.Z)}`;
}

function applyServerDemoState(): void {
	applyMarkerState(MARKER_PART_NAME, "First", first.ANNOUNCEMENT, first.PART_SIZE, first.PART_COLOR, first.SPAWN_OFFSET);
	applyMarkerState(SECONDARY_MARKER_PART_NAME, "Second", second.ANNOUNCEMENT, second.PART_SIZE, second.PART_COLOR, second.SPAWN_OFFSET);
}

firstConstants.subscribe(() => {
	applyServerDemoState();
});

secondConstants.subscribe(() => {
	applyServerDemoState();
});

applyServerDemoState();
