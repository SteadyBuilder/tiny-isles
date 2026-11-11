extends CanvasLayer
class_name GameHUD

## GameHUD
## Ultra-slim 36px single-line floating capsule HUD.

@onready var wood_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/WoodLabel
@onready var stone_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/StoneLabel
@onready var gold_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/GoldLabel
@onready var wave_label: Label = $TopBar/CapsulePanel/HBox/WaveContainer/WaveLabel
@onready var timer_label: Label = $TopBar/CapsulePanel/HBox/WaveContainer/TimerLabel

var selected_building: String = ""

func _ready() -> void:
	if GameManager:
		GameManager.resources_changed.connect(_on_resources_changed)
		GameManager.wave_state_changed.connect(_on_wave_state_changed)
		_on_resources_changed(GameManager.wood, GameManager.stone, GameManager.gold)

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("build_1"):
		try_select_building("wall")
	elif event.is_action_pressed("build_2"):
		try_select_building("tower")
	elif event.is_action_pressed("build_3"):
		try_select_building("core")

func _on_resources_changed(wood: int, stone: int, gold: int) -> void:
	if wood_label:
		wood_label.text = "🌲 " + str(wood)
	if stone_label:
		stone_label.text = "🪨 " + str(stone)
	if gold_label:
		gold_label.text = "🪙 " + str(gold)

func _on_wave_state_changed(state: String, remaining: float, wave_index: int) -> void:
	var minutes = int(remaining) / 60
	var seconds = int(remaining) % 60
	var time_str = "%02d:%02d" % [minutes, seconds]
	
	if timer_label:
		timer_label.text = time_str
		
	if wave_label:
		if state == "INVASION":
			wave_label.text = "⚔️ 침공 (W" + str(wave_index) + ")!"
			wave_label.modulate = Color(1.0, 0.35, 0.35)
		else:
			wave_label.text = "🕊️ 평화 (W" + str(wave_index) + ")"
			wave_label.modulate = Color(0.45, 0.9, 0.6)

func try_select_building(type: String) -> void:
	if GameManager.can_afford(type):
		selected_building = type
		place_building_at_player(type)
	else:
		print("자원이 부족합니다: ", type)

func place_building_at_player(type: String) -> void:
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
		
	var build_pos = player.global_position + Vector2(40, 0).rotated(randf() * TAU)
	
	if type != "core" and not GameManager.is_in_territory(build_pos):
		print("코어 영토 영역 내부에서만 건설할 수 있습니다!")
		return
		
	if GameManager.spend_for_building(type):
		var scene_path = ""
		match type:
			"wall":
				scene_path = "res://scenes/buildings/wall.tscn"
			"tower":
				scene_path = "res://scenes/buildings/tower.tscn"
			"core":
				scene_path = "res://scenes/buildings/core_crystal.tscn"
				
		var scene = load(scene_path) as PackedScene
		if scene:
			var inst = scene.instantiate() as Node2D
			inst.global_position = build_pos
			var entities = get_tree().get_first_node_in_group("entities")
			if entities:
				entities.add_child(inst)
			else:
				player.get_parent().add_child(inst)
