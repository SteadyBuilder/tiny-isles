extends CanvasLayer
class_name GameHUD

## GameHUD
## Displays resource counters, wave timer, health status, and building placement hotbar.

@onready var wood_label: Label = $TopBar/ResourceContainer/WoodLabel if has_node("TopBar/ResourceContainer/WoodLabel") else null
@onready var stone_label: Label = $TopBar/ResourceContainer/StoneLabel if has_node("TopBar/ResourceContainer/StoneLabel") else null
@onready var gold_label: Label = $TopBar/ResourceContainer/GoldLabel if has_node("TopBar/ResourceContainer/GoldLabel") else null
@onready var wave_label: Label = $TopBar/WaveContainer/WaveLabel if has_node("TopBar/WaveContainer/WaveLabel") else null
@onready var timer_label: Label = $TopBar/WaveContainer/TimerLabel if has_node("TopBar/WaveContainer/TimerLabel") else null

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
			wave_label.text = "⚔️ WAVE " + str(wave_index) + " INVASION!"
			wave_label.modulate = Color(1.0, 0.3, 0.3)
		else:
			wave_label.text = "🕊️ PREPARE (Wave " + str(wave_index) + ")"
			wave_label.modulate = Color(0.4, 0.9, 0.5)

func try_select_building(type: String) -> void:
	if GameManager.can_afford(type):
		selected_building = type
		place_building_at_player(type)
	else:
		# Flash resource insufficient feedback
		print("Insufficient resources for: ", type)

func place_building_at_player(type: String) -> void:
	var player = get_tree().get_first_node_in_group("player")
	if not player:
		return
		
	var build_pos = player.global_position + Vector2(40, 0).rotated(randf() * TAU)
	
	# Core check: expansion must be outside current core, towers must be inside
	if type != "core" and not GameManager.is_in_territory(build_pos):
		print("Must build inside active crystal territory!")
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
