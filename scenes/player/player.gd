extends CharacterBody2D
class_name Player

## Player Controller for Tiny Isles
## Tiny Swords Blue Warrior animation, 8-direction movement, attack & gather actions.

signal health_changed(current: float, max: float)
signal player_died()

@export var move_speed: float = 170.0
@export var max_health: float = 100.0
var current_health: float = 100.0

@export var attack_damage: float = 25.0
@export var attack_duration: float = 0.35
var attack_timer: float = 0.0

enum State { IDLE, RUN, ATTACK }
var current_state: State = State.IDLE

# Animation frames & timers
var anim_timer: float = 0.0
var current_frame: int = 0
var anim_fps: float = 10.0

# Preloaded Tiny Swords Blue Warrior textures
var tex_idle = preload("res://assets/tiny_swords/Units/Blue Units/Warrior/Warrior_Idle.png")
var tex_run = preload("res://assets/tiny_swords/Units/Blue Units/Warrior/Warrior_Run.png")
var tex_attack = preload("res://assets/tiny_swords/Units/Blue Units/Warrior/Warrior_Attack1.png")

@onready var sprite: Sprite2D = $Sprite2D
@onready var attack_area: Area2D = $AttackArea

func _ready() -> void:
	add_to_group("player")
	current_health = max_health
	emit_signal("health_changed", current_health, max_health)
	set_state(State.IDLE)

func _physics_process(delta: float) -> void:
	if attack_timer > 0.0:
		attack_timer -= delta
		if attack_timer <= 0.0:
			set_state(State.IDLE)

	# Attack input
	if Input.is_action_just_pressed("action_attack") and attack_timer <= 0.0:
		perform_attack()
		
	# Gather input
	if Input.is_action_just_pressed("action_gather") and attack_timer <= 0.0:
		perform_gather()

	# Movement (8-direction)
	var input_vector = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	if current_state == State.ATTACK:
		velocity = velocity.move_toward(Vector2.ZERO, move_speed * 4.0 * delta)
	else:
		if input_vector != Vector2.ZERO:
			velocity = input_vector.normalized() * move_speed
			update_facing(input_vector.x)
			if current_state != State.RUN:
				set_state(State.RUN)
		else:
			velocity = velocity.move_toward(Vector2.ZERO, move_speed * 6.0 * delta)
			if current_state != State.IDLE:
				set_state(State.IDLE)

	move_and_slide()
	update_sprite_animation(delta)

func set_state(new_state: State) -> void:
	current_state = new_state
	current_frame = 0
	anim_timer = 0.0
	
	match current_state:
		State.IDLE:
			sprite.texture = tex_idle
			sprite.hframes = 8
			sprite.vframes = 1
			anim_fps = 8.0
		State.RUN:
			sprite.texture = tex_run
			sprite.hframes = 6
			sprite.vframes = 1
			anim_fps = 10.0
		State.ATTACK:
			sprite.texture = tex_attack
			sprite.hframes = 4
			sprite.vframes = 1
			anim_fps = 11.0

func update_sprite_animation(delta: float) -> void:
	if not sprite:
		return
		
	anim_timer += delta
	var frame_duration = 1.0 / anim_fps
	
	if anim_timer >= frame_duration:
		anim_timer -= frame_duration
		current_frame += 1
		
		if current_frame >= sprite.hframes:
			if current_state == State.ATTACK:
				current_frame = sprite.hframes - 1
			else:
				current_frame = 0
				
		sprite.frame = current_frame

func update_facing(dir_x: float) -> void:
	if abs(dir_x) > 0.05:
		sprite.flip_h = (dir_x < 0)
		if attack_area:
			attack_area.scale.x = -1.0 if dir_x < 0 else 1.0

func perform_attack() -> void:
	set_state(State.ATTACK)
	attack_timer = attack_duration
	
	if attack_area:
		var bodies = attack_area.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("enemies") and body.has_method("take_damage"):
				body.take_damage(attack_damage)

func perform_gather() -> void:
	set_state(State.ATTACK)
	attack_timer = attack_duration
	
	if attack_area:
		var bodies = attack_area.get_overlapping_bodies()
		for body in bodies:
			if body.is_in_group("resources") and body.has_method("harvest"):
				body.harvest(1)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	emit_signal("health_changed", current_health, max_health)
	
	# Damage flash effect
	var tween = create_tween()
	tween.tween_property(sprite, "modulate", Color(1.5, 0.3, 0.3), 0.1)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.15)
		
	if current_health <= 0.0:
		die()

func die() -> void:
	emit_signal("player_died")
	queue_free()
