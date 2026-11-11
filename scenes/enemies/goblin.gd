extends CharacterBody2D
class_name GoblinEnemy

## Goblin Enemy AI
## Advances toward the closest CoreCrystal or Player, attacking obstacles and structures.

@export var move_speed: float = 85.0
@export var max_health: float = 40.0
@export var attack_damage: float = 12.0
@export var attack_rate: float = 1.0 # attacks per second
@export var attack_range: float = 32.0

var current_health: float = 40.0
var attack_cooldown: float = 0.0
var target_node: Node2D = null

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D if has_node("NavigationAgent2D") else null

func _ready() -> void:
	add_to_group("enemies")
	current_health = max_health
	find_next_target()

func _physics_process(delta: float) -> void:
	if attack_cooldown > 0.0:
		attack_cooldown -= delta

	if not is_instance_valid(target_node):
		find_next_target()
		if not target_node:
			velocity = Vector2.ZERO
			move_and_slide()
			return

	var dist = global_position.distance_to(target_node.global_position)
	
	if dist <= attack_range:
		# In attack range
		velocity = Vector2.ZERO
		if attack_cooldown <= 0.0:
			perform_attack()
			attack_cooldown = 1.0 / attack_rate
	else:
		# Move towards target
		var dir: Vector2
		if nav_agent and nav_agent.is_target_reachable():
			nav_agent.target_position = target_node.global_position
			dir = global_position.direction_to(nav_agent.get_next_path_position())
		else:
			dir = global_position.direction_to(target_node.global_position)
			
		velocity = dir * move_speed
		if sprite and abs(dir.x) > 0.05:
			sprite.flip_h = (dir.x < 0)

	move_and_slide()

func find_next_target() -> void:
	# Prioritize closest core crystal, then player
	var core = GameManager.get_closest_core(global_position) if GameManager else null
	if core:
		target_node = core
		return
		
	var player = get_tree().get_first_node_in_group("player")
	if player:
		target_node = player
	else:
		target_node = null

func perform_attack() -> void:
	if not is_instance_valid(target_node):
		return
		
	if target_node.has_method("take_damage"):
		target_node.take_damage(attack_damage)
		
	# Attack stretch/squash visual
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "scale", Vector2(1.2, 0.8), 0.1)
		tween.tween_property(sprite, "scale", Vector2.ONE, 0.1)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1, 0.2, 0.2), 0.1)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)
		
	if current_health <= 0.0:
		die()

func die() -> void:
	# Drop resource
	if GameManager:
		GameManager.add_resource("gold", randi_range(1, 3))
	queue_free()
