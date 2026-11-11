extends StaticBody2D
class_name CoreCrystal

## CoreCrystal (마을 코어 보석 및 정착지 중심)
## - 중심 마을(수도)은 처음부터 중소마을(small_village) 등급으로 시작하며, 코어 파괴 시 즉시 게임 패배
## - 외곽 영토는 미개척(야영지 대기) 상태로 시작하며, 정화(점령) 시 마을을 세울 수 있음
## - 외곽 영토의 코어가 마물에게 부숴지면 땅을 잃게 됨(오염/정지 상태) -> 재정화로 탈환 가능
## - 마을 발전: 야영지 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시

signal health_changed(current: float, max_hp: float)
signal state_updated()

@export var grid_x: int = 0
@export var grid_y: int = 0
@export var is_capital: bool = true
@export var is_unlocked: bool = true
@export var is_corrupted: bool = false
@export var village_tier: String = "small_village"
@export var territory_radius: float = 310.0

var max_health: float = 500.0
var current_health: float = 500.0
var regen_timer: float = 0.0

var tex_castle_blue = preload("res://assets/tiny_swords/Buildings/Blue Buildings/Castle.png")
var tex_castle_purple = preload("res://assets/tiny_swords/Buildings/Purple Buildings/Castle.png")
var tex_castle_yellow = preload("res://assets/tiny_swords/Buildings/Yellow Buildings/Castle.png")
var tex_castle_black = preload("res://assets/tiny_swords/Buildings/Black Buildings/Castle.png")
var tex_house1 = preload("res://assets/tiny_swords/Buildings/Blue Buildings/House1.png")
var tex_house2 = preload("res://assets/tiny_swords/Buildings/Blue Buildings/House2.png")
var tex_monastery = preload("res://assets/tiny_swords/Buildings/Blue Buildings/Monastery.png")

@onready var light: PointLight2D = $PointLight2D if has_node("PointLight2D") else null
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var health_bar: ProgressBar = $HealthBar if has_node("HealthBar") else null
var title_label: Label = null
var sub_houses_node: Node2D = null

func _ready() -> void:
	add_to_group("core_crystals")
	_create_floating_labels()
	_apply_tier_stats(true)
	if GameManager:
		GameManager.register_core(self)
	_refresh_visuals()

func _create_floating_labels() -> void:
	title_label = Label.new()
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.position = Vector2(-130, -218)
	title_label.custom_minimum_size = Vector2(260, 26)
	title_label.add_theme_font_size_override("font_size", 13)
	title_label.add_theme_color_override("font_outline_color", Color.BLACK)
	title_label.add_theme_constant_override("outline_size", 4)
	add_child(title_label)
	
	sub_houses_node = Node2D.new()
	sub_houses_node.name = "VillageHouses"
	sub_houses_node.y_sort_enabled = true
	add_child(sub_houses_node)

func _process(delta: float) -> void:
	if is_unlocked and not is_corrupted and current_health < max_health:
		var cfg = GameManager.VILLAGE_TIERS.get(village_tier, {}) if GameManager else {}
		var regen_rate: float = cfg.get("regen", 0.0)
		if regen_rate > 0.0:
			regen_timer += delta
			if regen_timer >= 1.0:
				regen_timer = 0.0
				current_health = min(max_health, current_health + regen_rate)
				if health_bar:
					health_bar.value = current_health
				emit_signal("health_changed", current_health, max_health)

func _apply_tier_stats(full_heal: bool = false) -> void:
	if not GameManager:
		return
	var cfg = GameManager.VILLAGE_TIERS.get(village_tier, GameManager.VILLAGE_TIERS["outpost"])
	max_health = cfg.max_hp
	if full_heal:
		current_health = max_health
	else:
		current_health = min(max_health, current_health + 150.0)
		
	if health_bar:
		health_bar.max_value = max_health
		health_bar.value = current_health
		health_bar.visible = is_unlocked and not is_corrupted
	emit_signal("health_changed", current_health, max_health)

func _refresh_visuals() -> void:
	if not sprite:
		return
	var key = "%d,%d" % [grid_x, grid_y]
	var t_info = GameManager.territories.get(key, {}) if GameManager else {}
	var t_name = t_info.get("name", "영토 (%d,%d)" % [grid_x, grid_y])
	var tier_cfg = GameManager.VILLAGE_TIERS.get(village_tier, {"name": "야영지"}) if GameManager else {"name": "야영지"}
	
	# 기존 부속 건물 초기화
	if sub_houses_node:
		for c in sub_houses_node.get_children():
			c.queue_free()
			
	if not is_unlocked:
		sprite.texture = tex_castle_black
		sprite.modulate = Color(0.55, 0.65, 0.75, 0.80)
		sprite.scale = Vector2(0.72, 0.72)
		if light:
			light.color = Color(0.4, 0.6, 0.9, 0.5)
			light.energy = 0.45
		if title_label:
			var cw = t_info.get("cost_wood", 15)
			var cs = t_info.get("cost_stone", 10)
			title_label.text = "🔒 %s [미점령: 🌲%d 🪨%d]" % [t_name, cw, cs]
			title_label.modulate = Color(0.85, 0.9, 1.0)
		if health_bar:
			health_bar.visible = false
		return

	if is_corrupted:
		sprite.texture = tex_castle_black
		sprite.modulate = Color(0.9, 0.3, 0.45, 0.9)
		sprite.scale = Vector2(0.85, 0.85)
		if light:
			light.color = Color(0.95, 0.15, 0.25, 0.85)
			light.energy = 0.85
		if title_label:
			title_label.text = "💀 %s [코어 파괴됨 - 재정화 필요]" % t_name
			title_label.modulate = Color(1.0, 0.4, 0.4)
		if health_bar:
			health_bar.visible = false
		return

	# 정상 점령된 마을 상태
	if health_bar:
		health_bar.visible = true
	sprite.modulate = Color.WHITE
	
	match village_tier:
		"outpost":
			sprite.texture = tex_house1
			sprite.scale = Vector2(0.95, 0.95)
		"small_village":
			sprite.texture = tex_castle_blue
			sprite.scale = Vector2(0.90, 0.90)
			_spawn_deco_house(tex_house1, Vector2(-115, 35))
			_spawn_deco_house(tex_house2, Vector2(115, 35))
		"large_village":
			sprite.texture = tex_castle_blue
			sprite.scale = Vector2(1.0, 1.0)
			_spawn_deco_house(tex_house1, Vector2(-125, 35))
			_spawn_deco_house(tex_house2, Vector2(125, 35))
			_spawn_deco_house(tex_house1, Vector2(-110, -65))
		"small_city":
			sprite.texture = tex_castle_purple
			sprite.scale = Vector2(1.04, 1.04)
			_spawn_deco_house(tex_house2, Vector2(-130, 40))
			_spawn_deco_house(tex_house2, Vector2(130, 40))
			_spawn_deco_house(tex_monastery, Vector2(0, -105))
		"mid_city", "metropolis":
			sprite.texture = tex_castle_yellow
			sprite.scale = Vector2(1.10, 1.10)
			_spawn_deco_house(tex_monastery, Vector2(-135, 35))
			_spawn_deco_house(tex_monastery, Vector2(135, 35))
			_spawn_deco_house(tex_house2, Vector2(-120, -75))
			_spawn_deco_house(tex_house2, Vector2(120, -75))

	if light:
		light.color = Color(0.25, 0.82, 1.0, 0.95) if is_capital else Color(0.35, 0.95, 0.65, 0.9)
		light.energy = 1.05
	if title_label:
		var prefix = "👑" if is_capital else "💎"
		title_label.text = "%s %s [%s]" % [prefix, t_name, tier_cfg.name]
		title_label.modulate = Color(1.0, 0.92, 0.45) if is_capital else Color(0.55, 0.98, 0.75)

func _spawn_deco_house(tex: Texture2D, offset_pos: Vector2) -> void:
	if not sub_houses_node:
		return
	var s = Sprite2D.new()
	s.texture = tex
	s.position = offset_pos
	s.offset = Vector2(0, -48)
	s.scale = Vector2(0.72, 0.72)
	sub_houses_node.add_child(s)

func get_radius() -> float:
	return territory_radius

func get_interaction_type() -> String:
	if not is_unlocked:
		return "claim"
	if is_corrupted:
		return "purify"
	return "upgrade"

func get_interaction_label() -> String:
	if not GameManager:
		return ""
	var key = "%d,%d" % [grid_x, grid_y]
	var t_info = GameManager.territories.get(key, {})
	if not is_unlocked:
		var cw = t_info.get("cost_wood", 15)
		var cs = t_info.get("cost_stone", 10)
		var cg = t_info.get("cost_gold", 0)
		return "✨ 영토 점령 및 코어 활성화 (🌲%d 🪨%d%s)" % [cw, cs, (" 🪙%d" % cg) if cg > 0 else ""]
	if is_corrupted:
		return "💎 오염된 코어 보석 재정화 (🌲20 🪨15)"
	var cfg = GameManager.VILLAGE_TIERS.get(village_tier, {})
	var next_key = cfg.get("next", "")
	if next_key != "":
		var next_cfg = GameManager.VILLAGE_TIERS.get(next_key, {})
		var cost = cfg.get("cost", {"wood": 30, "stone": 20, "gold": 5})
		return "🏰 [%s] 승급 (🌲%d 🪨%d 🪙%d)" % [next_cfg.get("name", "상위마을"), cost.wood, cost.stone, cost.gold]
	if current_health < max_health:
		return "🔧 코어 보석 긴급 수리 (🌲10 🪨5)"
	return "👑 최고 등급 대도시 달성!"

func interact() -> bool:
	if not GameManager:
		return false
	var key = "%d,%d" % [grid_x, grid_y]
	var t_info = GameManager.territories.get(key, {})
	
	# 1. 미점령 영토 점령
	if not is_unlocked:
		var cw = t_info.get("cost_wood", 15)
		var cs = t_info.get("cost_stone", 10)
		var cg = t_info.get("cost_gold", 0)
		if GameManager.spend_raw(cw, cs, cg):
			is_unlocked = true
			is_corrupted = false
			village_tier = "outpost"
			_apply_tier_stats(true)
			_refresh_visuals()
			GameManager.notify_core_state_changed(self)
			emit_signal("state_updated")
			return true
		return false
		
	# 2. 파괴(오염)된 외곽 코어 재정화
	if is_corrupted:
		if GameManager.spend_raw(20, 15, 0):
			is_corrupted = false
			_apply_tier_stats(true)
			_refresh_visuals()
			GameManager.notify_core_state_changed(self)
			emit_signal("state_updated")
			return true
		return false
		
	# 3. 마을 등급 발전 (중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시)
	var cfg = GameManager.VILLAGE_TIERS.get(village_tier, {})
	var next_key = cfg.get("next", "")
	if next_key != "":
		var cost = cfg.get("cost", {"wood": 30, "stone": 20, "gold": 5})
		if GameManager.spend_raw(cost.wood, cost.stone, cost.gold):
			village_tier = next_key
			_apply_tier_stats(false)
			_refresh_visuals()
			GameManager.notify_core_state_changed(self)
			emit_signal("state_updated")
			return true
			
	# 4. 체력이 깎여 있다면 수리
	if current_health < max_health and GameManager.spend_raw(10, 5, 0):
		current_health = min(max_health, current_health + 180.0)
		if health_bar:
			health_bar.value = current_health
		emit_signal("health_changed", current_health, max_health)
		return true
		
	return false

func take_damage(amount: float) -> void:
	if not is_unlocked or is_corrupted:
		return
		
	current_health = max(0.0, current_health - amount)
	emit_signal("health_changed", current_health, max_health)
	
	if health_bar:
		health_bar.value = current_health
		
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1.8, 0.25, 0.25), 0.08)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.14)
		
	if current_health <= 0.0:
		_on_core_shattered()

func _on_core_shattered() -> void:
	## 기획안 반영: 점령한 땅의 코어 보석이 부숴지면 땅을 잃게 됨 (오염/기능 정지)
	## 중심 수도 코어가 부숴지면 게임 패배
	is_corrupted = true
	_refresh_visuals()
	if GameManager:
		GameManager.notify_core_state_changed(self)
	emit_signal("state_updated")

func _draw() -> void:
	# 점령된 마을의 영토 경계선 은은하게 표시
	if is_unlocked and not is_corrupted:
		var col = Color(0.25, 0.85, 1.0, 0.18) if is_capital else Color(0.3, 0.95, 0.55, 0.15)
		draw_arc(Vector2.ZERO, territory_radius, 0.0, TAU, 64, col, 2.5)
