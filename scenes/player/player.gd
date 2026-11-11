extends CharacterBody2D
class_name Player

## Player Controller for Tiny Isles - Kingdom Guard
## 기본 캐릭터는 Pawn 으로 구성 (도끼, 곡괭이, 망치, 단검 등 상황에 맞는 Pawn 애니메이션 자동 전환)
## WASD + 모바일 플로팅 조이스틱 이동, 스페이스바/터치 대시, 스마트 오토 타겟팅 공격/채집, 전방 그리드 스냅 건축 지원

signal health_changed(current: float, max_hp: float)
signal player_died()

@export var move_speed: float = 185.0
@export var dash_speed: float = 440.0
@export var dash_duration: float = 0.18
@export var dash_cooldown: float = 1.1
@export var max_health: float = 120.0
var current_health: float = 120.0

@export var attack_damage: float = 28.0
@export var attack_duration: float = 0.30
var attack_timer: float = 0.0
var dash_timer: float = 0.0
var dash_cd_timer: float = 0.0

enum State { IDLE, RUN, ACT_AXE, ACT_PICKAXE, ACT_HAMMER, ACT_KNIFE }
var current_state: State = State.IDLE
var carried_tool: String = "axe" # "axe", "pickaxe", "hammer", "knife"

var facing_dir: Vector2 = Vector2.RIGHT
var anim_timer: float = 0.0
var current_frame: int = 0
var anim_fps: float = 10.0

# Preloaded Tiny Swords Blue Pawn textures (기본 캐릭터 Pawn 구성)
var tex_idle_base = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Idle.png")
var tex_idle_axe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Idle Axe.png")
var tex_idle_pickaxe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Idle Pickaxe.png")
var tex_idle_hammer = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Idle Hammer.png")
var tex_idle_knife = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Idle Knife.png")

var tex_run_base = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Run.png")
var tex_run_axe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Run Axe.png")
var tex_run_pickaxe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Run Pickaxe.png")
var tex_run_hammer = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Run Hammer.png")
var tex_run_knife = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Run Knife.png")

var tex_act_axe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Interact Axe.png")
var tex_act_pickaxe = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Interact Pickaxe.png")
var tex_act_hammer = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Interact Hammer.png")
var tex_act_knife = preload("res://assets/tiny_swords/Units/Blue Units/Pawn/Pawn_Interact Knife.png")

# 코스튬 스킨용 Yellow Pawn 텍스처 (미션 완수 보상)
var tex_yellow_idle = preload("res://assets/tiny_swords/Units/Yellow Units/Pawn/Pawn_Idle Axe.png")
var tex_yellow_run = preload("res://assets/tiny_swords/Units/Yellow Units/Pawn/Pawn_Run Axe.png")
var tex_yellow_act = preload("res://assets/tiny_swords/Units/Yellow Units/Pawn/Pawn_Interact Axe.png")

@onready var sprite: Sprite2D = $Sprite2D
@onready var attack_area: Area2D = $AttackArea
@onready var camera: Camera2D = $Camera2D if has_node("Camera2D") else null

# 전방 건축 미리보기 고스트 노드
var ghost_sprite: Sprite2D = null
var interact_target: Node2D = null

func _ready() -> void:
	add_to_group("player")
	current_health = max_health
	emit_signal("health_changed", current_health, max_health)
	_create_build_ghost()
	if GameManager:
		GameManager.selected_building_changed.connect(_on_selected_building_changed)
	set_state(State.IDLE)

func _create_build_ghost() -> void:
	ghost_sprite = Sprite2D.new()
	ghost_sprite.name = "BuildGhost"
	ghost_sprite.visible = false
	ghost_sprite.modulate = Color(0.3, 1.0, 0.5, 0.55)
	ghost_sprite.z_index = 5
	add_child(ghost_sprite)

func _on_selected_building_changed(b_type: String) -> void:
	if b_type != "":
		carried_tool = "hammer"
		ghost_sprite.visible = true
		match b_type:
			"fence":
				ghost_sprite.texture = preload("res://assets/tiny_swords/Terrain/Resources/Wood/Wood Resource/Wood Resource.png")
				ghost_sprite.scale = Vector2(1.1, 1.1)
			"wall":
				ghost_sprite.texture = preload("res://assets/tiny_swords/Terrain/Decorations/Rocks/Rock1.png")
				ghost_sprite.scale = Vector2(1.1, 1.1)
			"arrow_tower":
				ghost_sprite.texture = preload("res://assets/tiny_swords/Buildings/Blue Buildings/Tower.png")
				ghost_sprite.scale = Vector2(0.75, 0.75)
			"cannon_tower":
				ghost_sprite.texture = preload("res://assets/tiny_swords/Buildings/Blue Buildings/Archery.png")
				ghost_sprite.scale = Vector2(0.75, 0.75)
	else:
		ghost_sprite.visible = false
		carried_tool = "axe"
	if current_state == State.IDLE or current_state == State.RUN:
		set_state(current_state)

func _physics_process(delta: float) -> void:
	if GameManager and not GameManager.is_game_active:
		return
		
	if dash_cd_timer > 0.0:
		dash_cd_timer -= delta
		
	if dash_timer > 0.0:
		dash_timer -= delta
		velocity = facing_dir * dash_speed
		move_and_slide()
		update_sprite_animation(delta)
		return

	if attack_timer > 0.0:
		attack_timer -= delta
		if attack_timer <= 0.0:
			set_state(State.IDLE)

	# PC 키보드 입력 (Space 대시, E/F 상호작용, 좌클릭 공격/채집)
	if Input.is_physical_key_pressed(KEY_SPACE) and dash_cd_timer <= 0.0 and dash_timer <= 0.0:
		perform_dash()
		
	if Input.is_action_just_pressed("action_gather") or Input.is_physical_key_pressed(KEY_F):
		if attack_timer <= 0.0:
			perform_contextual_interact()

	if Input.is_action_pressed("action_attack") and attack_timer <= 0.0:
		# UI 위를 클릭한 게 아닐 때만 스마트 액션 수행
		if GameManager.selected_building == "":
			perform_smart_action()

	# 이동 벡터 (키보드 WASD + 모바일 플로팅 조이스틱 통합)
	var kb_vector = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	var joy_vector = GameManager.mobile_joystick_vector if GameManager else Vector2.ZERO
	var input_vector = joy_vector if joy_vector.length() > 0.05 else kb_vector
	
	if attack_timer > 0.0:
		velocity = velocity.move_toward(Vector2.ZERO, move_speed * 5.0 * delta)
	else:
		if input_vector != Vector2.ZERO:
			facing_dir = input_vector.normalized()
			# 소도시 이상 영토 내부에서는 이동속도 버프
			var speed_mult = 1.12 if (GameManager and GameManager.is_in_territory(global_position)) else 1.0
			velocity = facing_dir * move_speed * speed_mult
			update_facing(facing_dir.x)
			if current_state != State.RUN:
				set_state(State.RUN)
		else:
			velocity = velocity.move_toward(Vector2.ZERO, move_speed * 7.0 * delta)
			if current_state != State.IDLE:
				set_state(State.IDLE)

	move_and_slide()
	update_sprite_animation(delta)
	_update_build_ghost_position()
	_check_nearby_contextual_targets()

func _update_build_ghost_position() -> void:
	if not ghost_sprite or not ghost_sprite.visible:
		return
	var snap_pos = get_snapped_build_position()
	ghost_sprite.global_position = snap_pos
	var can_build = GameManager.is_in_territory(snap_pos) and GameManager.can_afford(GameManager.selected_building)
	ghost_sprite.modulate = Color(0.25, 1.0, 0.45, 0.65) if can_build else Color(1.0, 0.25, 0.25, 0.65)

func get_snapped_build_position() -> Vector2:
	var target_world = global_position + (facing_dir.normalized() * 68.0)
	var grid_step: float = 48.0
	return Vector2(
		 snapped(target_world.x, grid_step),
		 snapped(target_world.y, grid_step)
	)

func _check_nearby_contextual_targets() -> void:
	if not GameManager:
		return
	var best_core: CoreCrystal = null
	var min_d: float = 125.0
	for core in get_tree().get_nodes_in_group("core_crystals"):
		if is_instance_valid(core):
			var d = global_position.distance_to(core.global_position)
			if d < min_d:
				min_d = d
				best_core = core
				
	if best_core != interact_target:
		interact_target = best_core
		if best_core:
			GameManager.emit_signal("contextual_prompt_changed", best_core.get_interaction_type(), best_core.get_interaction_label(), best_core)
		else:
			GameManager.emit_signal("contextual_prompt_changed", "", "", null)
	elif best_core:
		# 라벨 갱신
		GameManager.emit_signal("contextual_prompt_changed", best_core.get_interaction_type(), best_core.get_interaction_label(), best_core)

func perform_dash() -> void:
	if dash_cd_timer > 0.0:
		return
	dash_timer = dash_duration
	dash_cd_timer = dash_cooldown
	# 잔상/대시 연출
	var tween = create_tween()
	tween.tween_property(sprite, "modulate", Color(0.5, 0.9, 1.8, 0.7), 0.08)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.12)

func perform_contextual_interact() -> void:
	if is_instance_valid(interact_target) and interact_target.has_method("interact"):
		carried_tool = "hammer"
		set_state(State.ACT_HAMMER)
		attack_timer = attack_duration
		interact_target.interact()

func perform_build_selected() -> bool:
	if not GameManager or GameManager.selected_building == "":
		return false
	var b_type = GameManager.selected_building
	var build_pos = get_snapped_build_position()
	
	if not GameManager.is_in_territory(build_pos):
		return false
	if not GameManager.spend_for_building(b_type):
		return false
		
	carried_tool = "hammer"
	set_state(State.ACT_HAMMER)
	attack_timer = attack_duration
	
	var scene_path = "res://scenes/buildings/wall.tscn"
	if b_type == "arrow_tower" or b_type == "cannon_tower":
		scene_path = "res://scenes/buildings/tower.tscn"
		
	var scene = load(scene_path) as PackedScene
	if scene:
		var inst = scene.instantiate() as Node2D
		inst.global_position = build_pos
		if inst.has_method("configure_building"):
			inst.configure_building(b_type)
		var entities = get_tree().get_first_node_in_group("entities")
		if entities:
			entities.add_child(inst)
		else:
			get_parent().add_child(inst)
	return true

func perform_smart_action() -> void:
	## 스마트 오토 타겟팅: 주변에 마물이 있으면 최우선으로 단검/도끼 타격, 없으면 가장 가까운 나무/광석/금광 채집
	if attack_timer > 0.0:
		return
		
	var closest_enemy: Node2D = null
	var min_enemy_dist: float = 82.0
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if is_instance_valid(enemy):
			var d = global_position.distance_to(enemy.global_position)
			if d < min_enemy_dist:
				min_enemy_dist = d
				closest_enemy = enemy
				
	if closest_enemy:
		var dir = global_position.direction_to(closest_enemy.global_position)
		facing_dir = dir
		update_facing(dir.x)
		carried_tool = "knife"
		set_state(State.ACT_KNIFE)
		attack_timer = attack_duration
		if closest_enemy.has_method("take_damage"):
			closest_enemy.take_damage(attack_damage)
		# 범위 내 다른 마물도 동시 타격
		if attack_area:
			for body in attack_area.get_overlapping_bodies():
				if body != closest_enemy and body.is_in_group("enemies") and body.has_method("take_damage"):
					body.take_damage(attack_damage * 0.75)
		return

	# 마물이 없으면 가장 가까운 자원(나무, 바위, 금광) 탐색
	var closest_res: Node2D = null
	var min_res_dist: float = 85.0
	for res in get_tree().get_nodes_in_group("resources"):
		if is_instance_valid(res):
			var d = global_position.distance_to(res.global_position)
			if d < min_res_dist:
				min_res_dist = d
				closest_res = res
				
	if closest_res:
		var dir = global_position.direction_to(closest_res.global_position)
		facing_dir = dir
		update_facing(dir.x)
		var r_type = closest_res.resource_type if "resource_type" in closest_res else "wood"
		if r_type == "wood":
			carried_tool = "axe"
			set_state(State.ACT_AXE)
		else:
			carried_tool = "pickaxe"
			set_state(State.ACT_PICKAXE)
		attack_timer = attack_duration
		if closest_res.has_method("harvest"):
			closest_res.harvest(1)
		return

	# 아무 타겟도 없으면 기본 도끼/단검 휘두르기
	carried_tool = "axe"
	set_state(State.ACT_AXE)
	attack_timer = attack_duration

func set_state(new_state: State) -> void:
	current_state = new_state
	current_frame = 0
	anim_timer = 0.0
	if not sprite:
		return
		
	var use_yellow = GameManager and GameManager.equipped_costume.begins_with("황금")
	
	match current_state:
		State.IDLE:
			if use_yellow:
				sprite.texture = tex_yellow_idle
			else:
				match carried_tool:
					"pickaxe": sprite.texture = tex_idle_pickaxe
					"hammer": sprite.texture = tex_idle_hammer
					"knife": sprite.texture = tex_idle_knife
					_: sprite.texture = tex_idle_axe
			sprite.hframes = 8
			sprite.vframes = 1
			anim_fps = 8.0
		State.RUN:
			if use_yellow:
				sprite.texture = tex_yellow_run
			else:
				match carried_tool:
					"pickaxe": sprite.texture = tex_run_pickaxe
					"hammer": sprite.texture = tex_run_hammer
					"knife": sprite.texture = tex_run_knife
					_: sprite.texture = tex_run_axe
			sprite.hframes = 6
			sprite.vframes = 1
			anim_fps = 11.0
		State.ACT_AXE:
			sprite.texture = tex_yellow_act if use_yellow else tex_act_axe
			sprite.hframes = 6
			sprite.vframes = 1
			anim_fps = 16.0
		State.ACT_PICKAXE:
			sprite.texture = tex_act_pickaxe
			sprite.hframes = 6
			sprite.vframes = 1
			anim_fps = 16.0
		State.ACT_HAMMER:
			sprite.texture = tex_act_hammer
			sprite.hframes = 3
			sprite.vframes = 1
			anim_fps = 12.0
		State.ACT_KNIFE:
			sprite.texture = tex_act_knife
			sprite.hframes = 4
			sprite.vframes = 1
			anim_fps = 15.0

func update_sprite_animation(delta: float) -> void:
	if not sprite:
		return
		
	anim_timer += delta
	var frame_duration = 1.0 / anim_fps
	
	if anim_timer >= frame_duration:
		anim_timer -= frame_duration
		current_frame += 1
		
		if current_frame >= sprite.hframes:
			if current_state in [State.ACT_AXE, State.ACT_PICKAXE, State.ACT_HAMMER, State.ACT_KNIFE]:
				current_frame = sprite.hframes - 1
			else:
				current_frame = 0
				
		sprite.frame = current_frame

func update_facing(dir_x: float) -> void:
	if abs(dir_x) > 0.05:
		sprite.flip_h = (dir_x < 0)
		if attack_area:
			attack_area.scale.x = -1.0 if dir_x < 0 else 1.0

func take_damage(amount: float) -> void:
	if dash_timer > 0.0:
		return # 대시 중 무적 회피!
	current_health = max(0.0, current_health - amount)
	emit_signal("health_changed", current_health, max_health)
	
	var tween = create_tween()
	tween.tween_property(sprite, "modulate", Color(1.8, 0.3, 0.3), 0.08)
	tween.tween_property(sprite, "modulate", Color.WHITE, 0.14)
		
	if current_health <= 0.0:
		# 플레이어 쓰러짐 시 수도 마을 코어 앞에서 부활 (협동 디펜스 지속)
		current_health = max_health
		var cap = GameManager.get_capital_core() if GameManager else null
		global_position = (cap.global_position + Vector2(0, 90)) if cap else Vector2(0, 90)
		emit_signal("health_changed", current_health, max_health)
