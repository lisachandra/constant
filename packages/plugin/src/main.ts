import { RunService } from "@rbxts/services";
import { startConstantPluginBootstrap, type ConstantPluginBootstrapHandle } from "./bootstrap";
import { formatConstantStudioPluginStatus } from "./studio-state";

declare global {
	interface DockWidgetPluginGui {
		Title: string;
	}
}

function main(plugin: Plugin): void {
	const TOOLBAR_NAME = "Constant";
	const TOOLBAR_BUTTON_ID = "ConstantBridge";
	const TOOLBAR_BUTTON_TOOLTIP = "Toggle the Constant plugin bridge status panel.";
	const WIDGET_ID = "lisachandra.constant.bridge";
	const WIDGET_TITLE = "Constant Bridge";

	interface ConstantStudioPluginWidget {
		readonly widget: DockWidgetPluginGui;
		readonly statusLabel: TextLabel;
		readonly reconnectButton: TextButton;
		readonly flushButton: TextButton;
	}

	function createStudioPluginWidget(): ConstantStudioPluginWidget {
		const widget = plugin.CreateDockWidgetPluginGuiAsync(
			WIDGET_ID,
			new DockWidgetPluginGuiInfo(
				Enum.InitialDockState.Right,
				true,
				false,
				320,
				180,
				260,
				140,
			),
		);
		widget.Title = WIDGET_TITLE
		widget.Name = WIDGET_TITLE;

		const content = new Instance("Frame");
		content.Name = "Content";
		content.Size = UDim2.fromScale(1, 1);
		content.BackgroundColor3 = Color3.fromRGB(28, 28, 28);
		content.BorderSizePixel = 0;
		content.Parent = widget;

		const padding = new Instance("UIPadding");
		padding.PaddingTop = new UDim(0, 12);
		padding.PaddingBottom = new UDim(0, 12);
		padding.PaddingLeft = new UDim(0, 12);
		padding.PaddingRight = new UDim(0, 12);
		padding.Parent = content;

		const listLayout = new Instance("UIListLayout");
		listLayout.FillDirection = Enum.FillDirection.Vertical;
		listLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
		listLayout.VerticalAlignment = Enum.VerticalAlignment.Top;
		listLayout.Padding = new UDim(0, 8);
		listLayout.Parent = content;

		const titleLabel = new Instance("TextLabel");
		titleLabel.Name = "Title";
		titleLabel.Size = new UDim2(1, 0, 0, 24);
		titleLabel.BackgroundTransparency = 1;
		titleLabel.Font = Enum.Font.BuilderSansBold;
		titleLabel.TextSize = 18;
		titleLabel.TextXAlignment = Enum.TextXAlignment.Left;
		titleLabel.TextColor3 = Color3.fromRGB(255, 255, 255);
		titleLabel.Text = "Constant Plugin Bridge";
		titleLabel.Parent = content;

		const statusLabel = new Instance("TextLabel");
		statusLabel.Name = "Status";
		statusLabel.Size = new UDim2(1, 0, 0, 22);
		statusLabel.BackgroundTransparency = 1;
		statusLabel.Font = Enum.Font.BuilderSans;
		statusLabel.TextSize = 16;
		statusLabel.TextWrapped = true;
		statusLabel.TextXAlignment = Enum.TextXAlignment.Left;
		statusLabel.TextColor3 = Color3.fromRGB(224, 224, 224);
		statusLabel.Text = "Starting...";
		statusLabel.Parent = content;

		const descriptionLabel = new Instance("TextLabel");
		descriptionLabel.Name = "Description";
		descriptionLabel.Size = new UDim2(1, 0, 0, 40);
		descriptionLabel.BackgroundTransparency = 1;
		descriptionLabel.Font = Enum.Font.BuilderSans;
		descriptionLabel.TextSize = 14;
		descriptionLabel.TextWrapped = true;
		descriptionLabel.TextXAlignment = Enum.TextXAlignment.Left;
		descriptionLabel.TextYAlignment = Enum.TextYAlignment.Top;
		descriptionLabel.TextColor3 = Color3.fromRGB(196, 196, 196);
		descriptionLabel.Text = "Auto-starts on Studio load and keeps listening when play mode begins.";
		descriptionLabel.Parent = content;

		const actions = new Instance("Frame");
		actions.Name = "Actions";
		actions.Size = new UDim2(1, 0, 0, 32);
		actions.BackgroundTransparency = 1;
		actions.Parent = content;

		const actionLayout = new Instance("UIListLayout");
		actionLayout.FillDirection = Enum.FillDirection.Horizontal;
		actionLayout.HorizontalAlignment = Enum.HorizontalAlignment.Left;
		actionLayout.VerticalAlignment = Enum.VerticalAlignment.Center;
		actionLayout.Padding = new UDim(0, 8);
		actionLayout.Parent = actions;

		const reconnectButton = new Instance("TextButton");
		reconnectButton.Name = "Reconnect";
		reconnectButton.Size = new UDim2(0, 112, 1, 0);
		reconnectButton.AutoButtonColor = true;
		reconnectButton.Font = Enum.Font.BuilderSansBold;
		reconnectButton.TextSize = 14;
		reconnectButton.TextColor3 = Color3.fromRGB(255, 255, 255);
		reconnectButton.BackgroundColor3 = Color3.fromRGB(55, 112, 255);
		reconnectButton.BorderSizePixel = 0;
		reconnectButton.Text = "Reconnect";
		reconnectButton.Parent = actions;

		const flushButton = new Instance("TextButton");
		flushButton.Name = "Flush";
		flushButton.Size = new UDim2(0, 112, 1, 0);
		flushButton.AutoButtonColor = true;
		flushButton.Font = Enum.Font.BuilderSansBold;
		flushButton.TextSize = 14;
		flushButton.TextColor3 = Color3.fromRGB(255, 255, 255);
		flushButton.BackgroundColor3 = Color3.fromRGB(38, 166, 91);
		flushButton.BorderSizePixel = 0;
		flushButton.Text = "Flush All";
		flushButton.Parent = actions;

		return { widget, statusLabel, reconnectButton, flushButton };
	}

	const toolbar = plugin.CreateToolbar(TOOLBAR_NAME);
	const toolbarButton = toolbar.CreateButton(TOOLBAR_BUTTON_ID, TOOLBAR_BUTTON_TOOLTIP, "rbxasset://textures/StudioSharedUI/animation_editor/icon_play.png");
	const studioWidget = createStudioPluginWidget();

	let bootstrapHandle: ConstantPluginBootstrapHandle | undefined;
	let heartbeatConnection: RBXScriptConnection | undefined;
	let isConnected = false;
	let wasRunning = RunService.IsRunning();

	function updateStudioPluginStatus(): void {
		studioWidget.statusLabel.Text = formatConstantStudioPluginStatus({
			connected: isConnected,
			playMode: RunService.IsRunning(),
		});
		toolbarButton.SetActive(studioWidget.widget.Enabled);
	}

	function disconnectBootstrap(): void {
		bootstrapHandle?.stop();
		bootstrapHandle = undefined;
		isConnected = false;
		updateStudioPluginStatus();
	}

	function ensureBootstrapConnected(): ConstantPluginBootstrapHandle {
		if (bootstrapHandle) {
			isConnected = true;
			updateStudioPluginStatus();
			return bootstrapHandle;
		}

		bootstrapHandle = startConstantPluginBootstrap({
			flushDelaySeconds: 0.25,
			autoFlush: true,
		});
		isConnected = true;
		updateStudioPluginStatus();
		return bootstrapHandle;
	}

	function reconnectBootstrap(): void {
		disconnectBootstrap();
		ensureBootstrapConnected();
	}

	toolbarButton.Click.Connect(() => {
		studioWidget.widget.Enabled = !studioWidget.widget.Enabled;
		updateStudioPluginStatus();
	});

	studioWidget.widget.GetPropertyChangedSignal("Enabled").Connect(() => {
		updateStudioPluginStatus();
	});

	studioWidget.reconnectButton.MouseButton1Click.Connect(() => {
		reconnectBootstrap();
	});

	studioWidget.flushButton.MouseButton1Click.Connect(() => {
		ensureBootstrapConnected().coordinator.flushAll();
		updateStudioPluginStatus();
	});

	ensureBootstrapConnected();
	updateStudioPluginStatus();

	heartbeatConnection = RunService.Heartbeat.Connect(() => {
		const isRunning = RunService.IsRunning();
		if (isRunning && !wasRunning) {
			ensureBootstrapConnected();
		}
		wasRunning = isRunning;
		updateStudioPluginStatus();
	});

	script.Destroying.Connect(() => {
		heartbeatConnection?.Disconnect();
		disconnectBootstrap();
	});
}

export = main
