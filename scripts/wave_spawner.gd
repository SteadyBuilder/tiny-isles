extends Node2D
class_name WaveSpawner

## WaveSpawner
## Spawns enemy goblins in waves around the perimeter during INVASION state.

@export var goblin_scene: PackedScene
@export var spawn_radius: float = 650.0
@export var spawn_interval: float = 2.5

var spawn_timer: float = 0.0
var goblins_to_spawn: int = 0

func _ready() -> void:
	if GameManager:
		GameManager.wave_state_changed.connect(_on_wave_state_changed)

func _process(delta: float) -> void:
	if GameManager.current_wave_state != GameManager.WaveState.INVASION:
		return
		
	if goblins_to_spawn > 0:
		spawn_timer -= delta
		if spawn_timer <= 0.0:
			spawn_timer = spawn_interval
			spawn_goblin()
			goblins_to_spawn -= 1

func _on_wave_state_changed(state: String, _remaining: float, wave_index: int) -> void:
	if state == "INVASION":
		# Scale goblins with wave number
		goblins_to_spawn = 5 + (wave_index * 4)
		spawn_timer = 0.5 # Start spawning immediately

func spawn_goblin() -> void:
	var player = get_tree().get_first_node_in_group("player")
	var center = player.global_position if player else global_position
	
	# Pick random angle outside player sight
	var angle = randf() * TAU
	var spawn_pos = center + Vector2(cos(angle), sin(angle)) * spawn_radius
	
	var goblin: Node2D
	if goblin_scene:
		goblin = goblin_scene.instantiate()
	else:
		# Fallback instance if scene not assigned
		var fallback_script = load("res://scenes/enemies/goblin.gd")
		var body = CharacterBody2D.new()
		body.set_script(fallback_script)
		goblin = body
		
	goblin.global_position = spawn_pos
	
	# Add to Y-sorted parent or world
	var entities = get_tree().get_first_node_in_group("entities")
	if entities:
		entities.add_child(goblin)
	else:
		get_parent().add_child(goblin)
