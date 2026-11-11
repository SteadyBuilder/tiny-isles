extends Node2D

## World Controller
## - 섬의 개념이 아닌 대륙 위 각 마을 단위(5x5 그리드 영토)로 확장되는 월드 생성
## - 중심 마을(0,0)은 처음부터 중소마을이며 나무 방책으로 둘러싸여 있음
## - 중심 마을과 인접한 땅은 기초 자원(목재, 석재)이 풍부하고, 외곽 땅은 희귀 자원(금광석)이 풍부함

var core_scene = preload("res://scenes/buildings/core_crystal.tscn")
var tree_scene = preload("res://scenes/world/resource_tree.tscn")
var gold_scene = preload("res://scenes/world/resource_gold.tscn")

@onready var ambient_light: DirectionalLight2D = $DirectionalLight2D if has_node("DirectionalLight2D") else null
@onready var entities_node: Node2D = $Entities if has_node("Entities") else self
@onready var ground_sprite: Sprite2D = $Ground if has_node("Ground") else null

func _ready() -> void:
	if ground_sprite:
		ground_sprite.region_rect = Rect2(-3600, -3600, 7200, 7200)
	if GameManager:
		GameManager.wave_state_changed.connect(_on_wave_state_changed)
	_setup_capital_and_expandable_territories()

func _setup_capital_and_expandable_territories() -> void:
	# 기존 CoreCastle 노드를 중심 수도 코어(0,0)로 설정
	var cap_core = entities_node.get_node_or_null("CoreCastle") as CoreCrystal
	if cap_core:
		cap_core.grid_x = 0
		cap_core.grid_y = 0
		cap_core.is_capital = true
		cap_core.is_unlocked = true
		cap_core.is_corrupted = false
		cap_core.village_tier = "small_village"
		cap_core._apply_tier_stats(true)
		cap_core._refresh_visuals()
		if GameManager:
			GameManager.register_core(cap_core)
			
	# 중심 수도의 기본 방책을 나무 방책(fence) 외형으로 초기화
	for child in entities_node.get_children():
		if child is DefenseWall and child.name.begins_with("Palisade"):
			child.configure_building("fence")

	# 중심 마을 주변 및 인접 영토에 풍부한 자원(나무, 바위, 금광)과 외곽 마을 코어 보석 배치
	var t_size: float = GameManager.TERRITORY_SIZE if GameManager else 640.0
	
	for gy in range(-2, 3):
		for gx in range(-2, 3):
			if gx == 0 and gy == 0:
				# 수도 내부/외곽 인접 기본 자원 추가 배치
				_spawn_resource_cluster(Vector2.ZERO, 6, 4, 1, 270.0, 340.0)
				continue
				
			var center_pos = Vector2(gx * t_size, gy * t_size)
			var dist = abs(gx) + abs(gy)
			
			# 외곽 마을 코어 보석(야영지 예정지) 생성
			var core_inst = core_scene.instantiate() as CoreCrystal
			core_inst.name = "VillageCore_%d_%d" % [gx, gy]
			core_inst.position = center_pos
			core_inst.grid_x = gx
			core_inst.grid_y = gy
			core_inst.is_capital = false
			core_inst.is_unlocked = false
			core_inst.is_corrupted = false
			core_inst.village_tier = "outpost"
			entities_node.add_child(core_inst)
			
			# 중심 마을과 인접한 땅(dist == 1)은 목재/석재가 매우 풍부함
			# 외곽 영토(dist >= 2)는 금광석 등 상위 자원이 풍부함
			if dist == 1:
				_spawn_resource_cluster(center_pos, 7, 5, 2, 130.0, 265.0)
			else:
				_spawn_resource_cluster(center_pos, 4, 4, 5, 130.0, 265.0)

func _spawn_resource_cluster(center: Vector2, num_trees: int, num_rocks: int, num_gold: int, min_r: float, max_r: float) -> void:
	for i in range(num_trees):
		var ang = (TAU / float(max(1, num_trees))) * i + randf_range(-0.25, 0.25)
		var r = randf_range(min_r, max_r)
		var node = tree_scene.instantiate() as ResourceNode
		node.position = center + Vector2(cos(ang), sin(ang)) * r
		node.resource_type = "wood"
		entities_node.add_child(node)
		
	for i in range(num_rocks):
		var ang = (TAU / float(max(1, num_rocks))) * i + 0.5 + randf_range(-0.25, 0.25)
		var r = randf_range(min_r, max_r)
		var node = gold_scene.instantiate() as ResourceNode
		node.position = center + Vector2(cos(ang), sin(ang)) * r
		node.resource_type = "stone"
		entities_node.add_child(node)
		node.configure_resource("stone")
		
	for i in range(num_gold):
		var ang = (TAU / float(max(1, num_gold))) * i + 1.1 + randf_range(-0.2, 0.2)
		var r = randf_range(min_r * 0.9, max_r * 0.95)
		var node = gold_scene.instantiate() as ResourceNode
		node.position = center + Vector2(cos(ang), sin(ang)) * r
		node.resource_type = "gold"
		entities_node.add_child(node)
		node.configure_resource("gold")

func _on_wave_state_changed(state: String, _remaining: float, _wave_index: int, is_boss: bool) -> void:
	if not ambient_light:
		return
		
	var tween = create_tween()
	if state == "INVASION":
		var night_col = Color(0.32, 0.16, 0.28) if is_boss else Color(0.22, 0.24, 0.40)
		tween.tween_property(ambient_light, "color", night_col, 2.5)
		tween.parallel().tween_property(ambient_light, "energy", 0.52, 2.5)
	else:
		tween.tween_property(ambient_light, "color", Color(1.0, 0.98, 0.92), 2.5)
		tween.parallel().tween_property(ambient_light, "energy", 0.85, 2.5)
