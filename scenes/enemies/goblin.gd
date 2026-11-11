extends CharacterBody2D
class_name RaiderEnemy

## Enemy AI (Tiny Swords Red Warrior Raider)
## Marches toward player's Castle Core or Player, attacking defenses along the path.

@export var move_speed: float = 95.0
@export var max_health: float = 45.0
@export var attack_damage: float = 12.0
@export var attack_rate: float = 1.0 # attacks per second
@export var attack_range: float = 42.0

var current_health: float = 45.0
var attack_cooldown: float = 0.0
var target_node: Node2D = null

enum State { IDLE, RUN, ATTACK }
var current_state: State = State.IDLE

var anim_timer: float = 0.0
var current_frame: int = 0
var anim_fps: float = 10.0

var tex_idle = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Idle.png")
var tex_run = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Run.png")
var tex_attack = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Attack1.png")

@onready var sprite: Sprite2D = $Sprite2D
@onready var nav_agent: NavigationAgent2D = $NavigationAgent2D if has_node("NavigationAgent2D") else null

func _ready() -> void:
	add_to_group("enemies")
	current_health = max_health
	find_next_target()
	set_state(State.IDLE)

func _physics_process(delta: float) -> void:
	if attack_cooldown > 0.0:
		attack_cooldown -= delta
		if attack_cooldown <= 0.0 and current_state == State.ATTACK:
			set_state(State.RUN)

	if not is_instance_valid(target_node):
		find_next_target()
		if not target_node:
			velocity = Vector2.ZERO
			set_state(State.IDLE)
			move_and_slide()
			update_sprite_animation(delta)
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
		var dir = global_position.direction_to(target_node.global_position)
		velocity = dir * move_speed
		
		if abs(dir.x) > 0.05:
			sprite.flip_h = (dir.x < 0)
			
		if current_state != State.RUN and attack_cooldown <= 0.0:
			set_state(State.RUN)

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
			anim_fps = 8.0
		State.RUN:
			sprite.texture = tex_run
			sprite.hframes = 6
			anim_fps = 10.0
		State.ATTACK:
			sprite.texture = tex_attack
			sprite.hframes = 4
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

func find_next_target() -> void:
	# Target Castle Core first, then Player
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
	set_state(State.ATTACK)
	
	if is_instance_valid(target_node) and target_node.has_method("take_damage"):
		target_node.take_damage(attack_damage)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	
	var tween = create_tween()
	tween.tween_property(sprite, "modulate", Color(2.0, 0.4, 0.4), 0.1)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)
		
	if current_health <= 0.0:
		die()

func die() -> void:
	if GameManager:
		GameManager.add_resource("gold", randi_range(1, 3))
	queue_free()
