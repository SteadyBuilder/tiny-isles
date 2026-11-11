extends CharacterBody2D
class_name RaiderEnemy

## Enemy AI (좀비, 스켈레톤, 보스 몬스터 통합 구현)
## - 몬스터 웨이브는 점령한 땅 외곽에서부터 진입하며 중심부 코어를 노림
## - 이동 경로를 가로막는 성벽/방책/타워도 공격하여 돌파

@export_enum("zombie", "skeleton", "boss") var monster_type: String = "zombie"
@export var move_speed: float = 82.0
@export var max_health: float = 55.0
@export var attack_damage: float = 14.0
@export var attack_rate: float = 1.0
@export var attack_range: float = 46.0

var current_health: float = 55.0
var attack_cooldown: float = 0.0
var target_node: Node2D = null
var retarget_timer: float = 0.0

enum State { IDLE, RUN, ATTACK }
var current_state: State = State.IDLE

var anim_timer: float = 0.0
var current_frame: int = 0
var anim_fps: float = 10.0

# Zombie (Red Warrior / Greenish undead tint)
var tex_z_idle = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Idle.png")
var tex_z_run = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Run.png")
var tex_z_atk = preload("res://assets/tiny_swords/Units/Red Units/Warrior/Warrior_Attack1.png")

# Skeleton (Red Archer / Bone-white tint)
var tex_s_idle = preload("res://assets/tiny_swords/Units/Red Units/Archer/Archer_Idle.png")
var tex_s_run = preload("res://assets/tiny_swords/Units/Red Units/Archer/Archer_Run.png")
var tex_s_atk = preload("res://assets/tiny_swords/Units/Red Units/Archer/Archer_Shoot.png")

# Boss Monster (Black Warrior Giant / Crimson aura)
var tex_b_idle = preload("res://assets/tiny_swords/Units/Black Units/Warrior/Warrior_Idle.png")
var tex_b_run = preload("res://assets/tiny_swords/Units/Black Units/Warrior/Warrior_Run.png")
var tex_b_atk = preload("res://assets/tiny_swords/Units/Black Units/Warrior/Warrior_Attack1.png")

var base_tint: Color = Color.WHITE
var idle_frames: int = 8
var run_frames: int = 6
var atk_frames: int = 4

@onready var sprite: Sprite2D = $Sprite2D

func _ready() -> void:
	add_to_group("enemies")
	configure_monster(monster_type)
	find_next_target()
	set_state(State.IDLE)

func configure_monster(m_type: String) -> void:
	monster_type = m_type
	match monster_type:
		"skeleton":
			move_speed = 95.0
			max_health = 45.0
			attack_damage = 16.0
			attack_range = 155.0
			attack_rate = 0.85
			base_tint = Color(0.92, 0.95, 1.0)
			idle_frames = 6
			run_frames = 4
			atk_frames = 8
			if sprite:
				sprite.scale = Vector2(0.95, 0.95)
		"boss":
			move_speed = 64.0
			max_health = 520.0
			attack_damage = 45.0
			attack_range = 68.0
			attack_rate = 0.75
			base_tint = Color(1.25, 0.55, 0.65)
			idle_frames = 8
			run_frames = 6
			atk_frames = 4
			if sprite:
				sprite.scale = Vector2(1.55, 1.55)
		_: # "zombie"
			move_speed = 78.0
			max_health = 62.0
			attack_damage = 14.0
			attack_range = 44.0
			attack_rate = 1.0
			base_tint = Color(0.75, 1.05, 0.78)
			idle_frames = 8
			run_frames = 6
			atk_frames = 4
			if sprite:
				sprite.scale = Vector2(1.0, 1.0)
				
	current_health = max_health
	if sprite:
		sprite.modulate = base_tint

func _physics_process(delta: float) -> void:
	if GameManager and not GameManager.is_game_active:
		return
		
	if attack_cooldown > 0.0:
		attack_cooldown -= delta
		if attack_cooldown <= 0.0 and current_state == State.ATTACK:
			set_state(State.RUN)

	retarget_timer += delta
	if retarget_timer >= 0.8 or not is_instance_valid(target_node):
		retarget_timer = 0.0
		find_next_target()
		
	if not is_instance_valid(target_node):
		velocity = Vector2.ZERO
		set_state(State.IDLE)
		move_and_slide()
		update_sprite_animation(delta)
		return

	var dist = global_position.distance_to(target_node.global_position)
	
	if dist <= attack_range:
		velocity = Vector2.ZERO
		if attack_cooldown <= 0.0:
			perform_attack()
			attack_cooldown = 1.0 / attack_rate
	else:
		var dir = global_position.direction_to(target_node.global_position)
		velocity = dir * move_speed
		
		if abs(dir.x) > 0.05 and sprite:
			sprite.flip_h = (dir.x < 0)
			
		if current_state != State.RUN and attack_cooldown <= 0.0:
			set_state(State.RUN)

	move_and_slide()
	update_sprite_animation(delta)

func set_state(new_state: State) -> void:
	current_state = new_state
	current_frame = 0
	anim_timer = 0.0
	if not sprite:
		return
		
	match current_state:
		State.IDLE:
			sprite.texture = tex_s_idle if monster_type == "skeleton" else (tex_b_idle if monster_type == "boss" else tex_z_idle)
			sprite.hframes = idle_frames
			anim_fps = 8.0
		State.RUN:
			sprite.texture = tex_s_run if monster_type == "skeleton" else (tex_b_run if monster_type == "boss" else tex_z_run)
			sprite.hframes = run_frames
			anim_fps = 10.0
		State.ATTACK:
			sprite.texture = tex_s_atk if monster_type == "skeleton" else (tex_b_atk if monster_type == "boss" else tex_z_atk)
			sprite.hframes = atk_frames
			anim_fps = 12.0

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
	# 1. 바로 앞을 가로막는 성벽/방책/타워가 있으면 우선 공격
	var closest_blocker: Node2D = null
	var min_block_dist: float = 75.0
	for b in get_tree().get_nodes_in_group("defend_targets"):
		if is_instance_valid(b):
			var d = global_position.distance_to(b.global_position)
			if d < min_block_dist:
				min_block_dist = d
				closest_blocker = b
	if closest_blocker:
		target_node = closest_blocker
		return

	# 2. 플레이어가 매우 가까우면 추격
	var player = get_tree().get_first_node_in_group("player")
	if is_instance_valid(player) and global_position.distance_to(player.global_position) <= 130.0:
		target_node = player
		return

	# 3. 점령된 마을의 코어 보석(외곽 코어 -> 수도 코어 순)을 향해 진군
	var core = GameManager.get_closest_active_core(global_position) if GameManager else null
	if core:
		target_node = core
		return
		
	target_node = player

func perform_attack() -> void:
	set_state(State.ATTACK)
	if is_instance_valid(target_node) and target_node.has_method("take_damage"):
		target_node.take_damage(attack_damage)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(2.2, 0.35, 0.35), 0.07)
		tween.tween_property(sprite, "modulate", base_tint, 0.12)
		
	if current_health <= 0.0:
		die()

func die() -> void:
	if GameManager:
		if monster_type == "boss":
			GameManager.add_resource("gold", 25)
			GameManager.add_resource("wood", 30)
			GameManager.add_resource("stone", 30)
		else:
			GameManager.add_resource("gold", randi_range(1, 3))
	queue_free()
