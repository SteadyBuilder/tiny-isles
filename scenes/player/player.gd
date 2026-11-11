extends CharacterBody2D
class_name Player

## Player Controller for Tiny Isles
## Supports 8-direction movement, attack/gather actions, and sprite flipping.

signal health_changed(current: float, max: float)
signal player_died()

@export var move_speed: float = 160.0
@export var max_health: float = 100.0
var current_health: float = 100.0

@export var attack_damage: float = 25.0
@export var attack_cooldown: float = 0.4
var attack_timer: float = 0.0

var is_attacking: bool = false
var is_gathering: bool = false

@onready var animation_player: AnimationPlayer = $AnimationPlayer if has_node("AnimationPlayer") else null
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var attack_area: Area2D = $AttackArea if has_node("AttackArea") else null

func _ready() -> void:
	add_to_group("player")
	current_health = max_health
	emit_signal("health_changed", current_health, max_health)

func _physics_process(delta: float) -> void:
	if attack_timer > 0.0:
		attack_timer -= delta
		if attack_timer <= 0.0:
			is_attacking = false
			is_gathering = false

	# Attack input
	if Input.is_action_just_pressed("action_attack") and attack_timer <= 0.0:
		perform_attack()
		
	# Gather input
	if Input.is_action_just_pressed("action_gather") and attack_timer <= 0.0:
		perform_gather()

	# Movement (8-direction)
	var input_vector = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	if is_attacking or is_gathering:
		velocity = velocity.move_toward(Vector2.ZERO, move_speed * 4.0 * delta)
	else:
		if input_vector != Vector2.ZERO:
			velocity = input_vector.normalized() * move_speed
			update_facing(input_vector.x)
		else:
			velocity = velocity.move_toward(Vector2.ZERO, move_speed * 6.0 * delta)

	move_and_slide()
	update_animations(input_vector)

func update_facing(dir_x: float) -> void:
	if abs(dir_x) > 0.05:
		if sprite:
			sprite.flip_h = (dir_x < 0)
		if attack_area:
			attack_area.scale.x = -1.0 if dir_x < 0 else 1.0

func update_animations(input_vec: Vector2) -> void:
	if not animation_player:
		return
	if is_attacking:
		if animation_player.has_animation("attack"):
			animation_player.play("attack")
	elif is_gathering:
		if animation_player.has_animation("gather"):
			animation_player.play("gather")
	elif input_vec != Vector2.ZERO:
		if animation_player.has_animation("run"):
			animation_player.play("run")
	else:
		if animation_player.has_animation("idle"):
			animation_player.play("idle")

func perform_attack() -> void:
	is_attacking = true
	attack_timer = attack_cooldown
	
	if attack_area:
		var bodies = attack_area.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("enemies") and body.has_method("take_damage"):
				body.take_damage(attack_damage)

func perform_gather() -> void:
	is_gathering = true
	attack_timer = 0.5
	
	# Check for resource nodes (Trees, Rocks, Gold mines)
	if attack_area:
		var bodies = attack_area.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("resources") and body.has_method("harvest"):
				body.harvest(1)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	emit_signal("health_changed", current_health, max_health)
	
	# Damage flash effect
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1, 0.3, 0.3), 0.1)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.15)
		
	if current_health <= 0.0:
		die()

func die() -> void:
	emit_signal("player_died")
	queue_free()
