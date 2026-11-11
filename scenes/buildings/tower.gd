extends StaticBody2D
class_name DefenseTower

## DefenseTower
## 화살 타워(arrow_tower) 및 공성 마법/대포 타워(cannon_tower) 지원
## 영토의 코어 보석이 활성 상태여야 작동하며, 마을 발전 등급(소도시/대도시 등)에 따라 사거리 및 공격력 버프를 받음

@export var building_subtype: String = "arrow_tower" # "arrow_tower" or "cannon_tower"
@export var max_health: float = 200.0
@export var attack_range: float = 240.0
@export var damage: float = 22.0
@export var fire_rate: float = 1.15 # shots per second
@export var splash_radius: float = 0.0

var current_health: float = 200.0
var fire_timer: float = 0.0
var current_target: Node2D = null

var tex_arrow_tower = preload("res://assets/tiny_swords/Buildings/Blue Buildings/Tower.png")
var tex_cannon_tower = preload("res://assets/tiny_swords/Buildings/Yellow Buildings/Tower.png")

@onready var range_area: Area2D = $RangeArea if has_node("RangeArea") else null
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("towers")
	add_to_group("defend_targets")
	configure_building(building_subtype)

func configure_building(b_type: String) -> void:
	building_subtype = b_type
	if b_type == "cannon_tower":
		max_health = 320.0
		current_health = max_health
		attack_range = 290.0
		damage = 58.0
		fire_rate = 0.55
		splash_radius = 85.0
		if sprite:
			sprite.texture = tex_cannon_tower
	else:
		max_health = 200.0
		current_health = max_health
		attack_range = 235.0
		damage = 22.0
		fire_rate = 1.2
		splash_radius = 0.0
		if sprite:
			sprite.texture = tex_arrow_tower

func _physics_process(delta: float) -> void:
	if fire_timer > 0.0:
		fire_timer -= delta
		
	# 점령지의 코어 보석이 파괴(오염)되었거나 영토 밖이면 작동 중지
	if GameManager and not GameManager.is_in_territory(global_position):
		modulate = Color(0.5, 0.5, 0.55, 0.8)
		return
	else:
		modulate = Color.WHITE

	var buff = GameManager.get_territory_buff_at(global_position) if GameManager else {"damage_mult": 1.0, "range_mult": 1.0}
	var effective_range = attack_range * buff.get("range_mult", 1.0)
	var effective_damage = damage * buff.get("damage_mult", 1.0)

	update_target(effective_range)
	
	if current_target and fire_timer <= 0.0:
		shoot_at_target(effective_damage)
		fire_timer = 1.0 / fire_rate

func update_target(eff_range: float) -> void:
	var closest: Node2D = null
	var min_dist: float = eff_range
	
	for body in get_tree().get_nodes_in_group("enemies"):
		if is_instance_valid(body):
			var dist = global_position.distance_to(body.global_position)
			if dist <= min_dist:
				min_dist = dist
				closest = body
				
	current_target = closest

func shoot_at_target(eff_damage: float) -> void:
	if not is_instance_valid(current_target):
		return
		
	var target_pos = current_target.global_position
	_spawn_shot_line(target_pos)
	
	if splash_radius > 0.0:
		# 공성 타워 광역 피해
		for enemy in get_tree().get_nodes_in_group("enemies"):
			if is_instance_valid(enemy) and enemy.global_position.distance_to(target_pos) <= splash_radius:
				if enemy.has_method("take_damage"):
					enemy.take_damage(eff_damage)
	else:
		if current_target.has_method("take_damage"):
			current_target.take_damage(eff_damage)
		
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1.4, 1.4, 1.1), 0.07)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)

func _spawn_shot_line(target_pos: Vector2) -> void:
	var line = Line2D.new()
	line.width = 4.0 if splash_radius > 0.0 else 2.2
	line.default_color = Color(1.0, 0.65, 0.2, 0.9) if splash_radius > 0.0 else Color(0.75, 0.95, 1.0, 0.85)
	line.add_point(global_position + Vector2(0, -65))
	line.add_point(target_pos + Vector2(0, -16))
	get_parent().add_child(line)
	var tw = line.create_tween()
	tw.tween_property(line, "modulate:a", 0.0, 0.16)
	tw.tween_callback(line.queue_free)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1.6, 0.3, 0.3), 0.08)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.12)
	if current_health <= 0.0:
		queue_free()
