extends Node

## GameManager (Singleton / Autoload)
## 기획안 전체 반영:
## - 마을 단위 5x5 영토(Territory Grid) 시스템 (중심 수도는 중소마을 + 나무 방책 시작)
## - 코어 보석 파괴 시 영토 상실(오염/정지) 및 정화(재탈환) 시스템
## - 마을 발전 6단계: 야영지 -> 중소마을 -> 큰마을 -> 소도시 -> 중소도시 -> 대도시
## - 30분 모드 / 60분 모드 방 생성 세션 시스템 및 웨이브 조기 호출
## - 미션 완수 시 메타 프로그레션 보상 (다음 미션 어드밴티지 / 개인 캐릭터 코스튬)

signal resources_changed(wood: int, stone: int, gold: int)
signal wave_state_changed(state: String, time_remaining: float, wave_index: int, is_boss_wave: bool)
signal session_updated(elapsed: float, total: float, mode_minutes: int)
signal core_registered(core_node: Node2D)
signal core_destroyed(core_node: Node2D)
signal territory_changed()
signal game_over(victory: bool)
signal selected_building_changed(building_type: String)
signal warning_direction_changed(dir_str: String, monster_count: int)
signal contextual_prompt_changed(prompt_type: String, label_text: String, target_node: Node2D)
signal meta_reward_unlocked(perk_active: bool, costume_name: String)

# --- Resources ---
var wood: int = 50
var stone: int = 25
var gold: int = 10

# --- Meta Progression (미션 완수 보상: 어드밴티지 & 코스튬) ---
var has_next_mission_advantage: bool = false
var unlocked_costumes: Array[String] = ["기본 개척자 (Blue Pawn)"]
var equipped_costume: String = "기본 개척자 (Blue Pawn)"

# --- Session & Wave Timer ---
var session_mode_minutes: int = 30 # 30 or 60
var total_survival_time: float = 1800.0
var elapsed_game_time: float = 0.0
var wave_countdown: float = 120.0 # Time until next wave
var current_wave: int = 1
var is_boss_wave: bool = false
var is_game_active: bool = false # Starts after room/session mode selection

enum WaveState { PEACE, INVASION }
var current_wave_state: WaveState = WaveState.PEACE

# --- Mobile & Input Shared State ---
var mobile_joystick_vector: Vector2 = Vector2.ZERO
var selected_building: String = "" # "", "fence", "wall", "arrow_tower", "cannon_tower"
var current_warning_dir: String = ""

# --- Village Tiers (마을 발전 6단계) ---
const VILLAGE_TIERS = {
	"outpost": {
		"name": "야영지",
		"next": "small_village",
		"cost": {"wood": 20, "stone": 15, "gold": 0},
		"max_hp": 300.0,
		"damage_mult": 1.0,
		"range_mult": 1.0,
		"regen": 0.0,
		"desc": "기초 방어 타워 및 방책 건설 가능"
	},
	"small_village": {
		"name": "중소마을",
		"next": "large_village",
		"cost": {"wood": 45, "stone": 35, "gold": 5},
		"max_hp": 500.0,
		"damage_mult": 1.05,
		"range_mult": 1.0,
		"regen": 1.5,
		"desc": "주민 자동 채집 및 코어 미세 회복"
	},
	"large_village": {
		"name": "큰마을",
		"next": "small_city",
		"cost": {"wood": 80, "stone": 70, "gold": 15},
		"max_hp": 800.0,
		"damage_mult": 1.15,
		"range_mult": 1.05,
		"regen": 3.0,
		"desc": "석재 성벽 강화 및 타워 공격력 +15%"
	},
	"small_city": {
		"name": "소도시",
		"next": "mid_city",
		"cost": {"wood": 130, "stone": 120, "gold": 30},
		"max_hp": 1150.0,
		"damage_mult": 1.20,
		"range_mult": 1.20,
		"regen": 5.0,
		"desc": "영토 내 타워 사거리 +20% 및 아군 이속 버프"
	},
	"mid_city": {
		"name": "중소도시",
		"next": "metropolis",
		"cost": {"wood": 200, "stone": 180, "gold": 50},
		"max_hp": 1650.0,
		"damage_mult": 1.30,
		"range_mult": 1.25,
		"regen": 8.0,
		"desc": "보호막 오라 활성화 및 타워 공속 증가"
	},
	"metropolis": {
		"name": "대도시",
		"next": "",
		"cost": {"wood": 0, "stone": 0, "gold": 0},
		"max_hp": 2500.0,
		"damage_mult": 1.50,
		"range_mult": 1.35,
		"regen": 12.0,
		"desc": "최종 단계: 전 구역 공격력 +50% 및 공성 화력 극대화"
	}
}

# --- Building Definitions (방어 타워, 성벽, 기본/특수 건물) ---
const BUILD_COSTS = {
	"fence": {
		"name": "나무 방책",
		"wood": 5, "stone": 0, "gold": 0,
		"desc": "마물의 진입을 저지하는 기초 목재 방책"
	},
	"wall": {
		"name": "석재 성벽",
		"wood": 0, "stone": 12, "gold": 0,
		"desc": "높은 내구도로 마물 웨이브를 막아내는 성벽"
	},
	"arrow_tower": {
		"name": "화살 타워",
		"wood": 15, "stone": 10, "gold": 0,
		"desc": "단일 마물을 빠르게 요격하는 기본 방어 타워"
	},
	"cannon_tower": {
		"name": "공성 마법/대포탑",
		"wood": 10, "stone": 25, "gold": 8,
		"desc": "강력한 범위 폭발 피해를 입히는 특수 방어 타워"
	}
}

# --- Territory Grid Data (5x5 Villages, Tile unit = 640px per village) ---
const TERRITORY_SIZE: float = 640.0
var territories: Dictionary = {} # key: "gx,gy" -> Dictionary
var active_cores: Array[Node2D] = []
var all_cores: Array[Node2D] = []

const TERRITORY_NAMES = {
	"0,0": "중심 수도 마을 (Capital)",
	"1,0": "동쪽 풍요의 삼림",
	"-1,0": "서쪽 황금 광산촌",
	"0,1": "남쪽 거석 채석장",
	"0,-1": "북쪽 성소 마을",
	"1,1": "남동쪽 바람 과수원",
	"-1,1": "남서쪽 흑요석 계곡",
	"1,-1": "북동쪽 에메랄드 숲",
	"-1,-1": "북서쪽 고대 유적지",
	"2,0": "극동 거목 요새",
	"-2,0": "극서 태양의 제단",
	"0,2": "남단 화강암 보루",
	"0,-2": "북단 별빛 감시초소"
}

var passive_gather_timer: float = 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_init_territory_grid_data()
	emit_signal("resources_changed", wood, stone, gold)

func _init_territory_grid_data() -> void:
	territories.clear()
	for gy in range(-2, 3):
		for gx in range(-2, 3):
			var key = "%d,%d" % [gx, gy]
			var dist = abs(gx) + abs(gy)
			var is_cap = (gx == 0 and gy == 0)
			var t_name = TERRITORY_NAMES.get(key, "외곽 개척지 (%d, %d)" % [gx, gy])
			territories[key] = {
				"gx": gx,
				"gy": gy,
				"name": t_name,
				"unlocked": is_cap,
				"corrupted": false,
				"is_capital": is_cap,
				"tier": "small_village" if is_cap else "outpost",
				"cost_wood": 0 if is_cap else 15 * dist,
				"cost_stone": 0 if is_cap else 10 * dist,
				"cost_gold": 0 if is_cap else max(0, (dist - 1) * 5),
				"core_node": null
			}

func start_session(mode_mins: int) -> void:
	session_mode_minutes = mode_mins
	total_survival_time = float(mode_mins * 60)
	elapsed_game_time = 0.0
	current_wave = 1
	current_wave_state = WaveState.PEACE
	is_boss_wave = false
	
	# 30분/60분 기획안 대응 + 인게임 체감을 위한 첫 웨이브 타이머 (조기 호출 가능)
	wave_countdown = 90.0 if mode_mins == 30 else 120.0
	
	# 시작 자원 설정 (어드밴티지 보유 시 보너스 지급)
	wood = 60 + (50 if has_next_mission_advantage else 0)
	stone = 35 + (50 if has_next_mission_advantage else 0)
	gold = 15 + (20 if has_next_mission_advantage else 0)
	
	is_game_active = true
	emit_signal("resources_changed", wood, stone, gold)
	emit_signal("session_updated", elapsed_game_time, total_survival_time, session_mode_minutes)
	emit_signal("wave_state_changed", "PEACE", wave_countdown, current_wave, is_boss_wave)

func _process(delta: float) -> void:
	if not is_game_active:
		return
		
	elapsed_game_time += delta
	emit_signal("session_updated", elapsed_game_time, total_survival_time, session_mode_minutes)
	
	# 주민 NPC 자동 자원 채집 (중소마을 이상 등급 영토 수에 비례)
	passive_gather_timer += delta
	if passive_gather_timer >= 5.0:
		passive_gather_timer = 0.0
		_process_village_passive_income()
	
	if elapsed_game_time >= total_survival_time:
		victory()
		return
		
	wave_countdown -= delta
	if wave_countdown <= 0.0:
		if current_wave_state == WaveState.PEACE:
			start_invasion()
		else:
			end_invasion()
			
	var enemies = get_tree().get_nodes_in_group("enemies")
	emit_signal("wave_state_changed", 
		"INVASION" if current_wave_state == WaveState.INVASION else "PEACE",
		max(0.0, wave_countdown),
		current_wave,
		is_boss_wave
	)
	
	if current_wave_state == WaveState.INVASION:
		emit_signal("warning_direction_changed", current_warning_dir, enemies.size())

func _process_village_passive_income() -> void:
	var bonus_wood: int = 0
	var bonus_stone: int = 0
	for core in active_cores:
		if is_instance_valid(core) and not core.is_corrupted:
			if core.village_tier != "outpost":
				bonus_wood += 2
				bonus_stone += 1
	if bonus_wood > 0 or bonus_stone > 0:
		wood += bonus_wood
		stone += bonus_stone
		emit_signal("resources_changed", wood, stone, gold)

func call_wave_early() -> void:
	if not is_game_active or current_wave_state == WaveState.INVASION:
		return
	# 조기 호출 보너스 자원 지급
	var bonus_w = 15 + (current_wave * 5)
	var bonus_s = 10 + (current_wave * 3)
	var bonus_g = 5
	wood += bonus_w
	stone += bonus_s
	gold += bonus_g
	emit_signal("resources_changed", wood, stone, gold)
	start_invasion()

func start_invasion() -> void:
	current_wave_state = WaveState.INVASION
	# 매 3번째 웨이브 또는 마지막 웨이브에 보스 몬스터 출현
	is_boss_wave = (current_wave % 3 == 0) or (elapsed_game_time >= total_survival_time * 0.75)
	wave_countdown = 45.0 + (current_wave * 5.0)
	emit_signal("wave_state_changed", "INVASION", wave_countdown, current_wave, is_boss_wave)

func end_invasion() -> void:
	current_wave_state = WaveState.PEACE
	current_wave += 1
	is_boss_wave = false
	wave_countdown = 90.0 if session_mode_minutes == 30 else 120.0
	current_warning_dir = ""
	emit_signal("warning_direction_changed", "", 0)
	emit_signal("wave_state_changed", "PEACE", wave_countdown, current_wave, is_boss_wave)

# --- Resource & Building Selection ---

func add_resource(type: String, amount: int) -> void:
	match type:
		"wood":
			wood += amount
		"stone":
			stone += amount
		"gold":
			gold += amount
	emit_signal("resources_changed", wood, stone, gold)

func can_afford(building_type: String) -> bool:
	if not BUILD_COSTS.has(building_type):
		return false
	var cost = BUILD_COSTS[building_type]
	return wood >= cost.wood and stone >= cost.stone and gold >= cost.gold

func can_afford_raw(w: int, s: int, g: int) -> bool:
	return wood >= w and stone >= s and gold >= g

func spend_raw(w: int, s: int, g: int) -> bool:
	if not can_afford_raw(w, s, g):
		return false
	wood -= w
	stone -= s
	gold -= g
	emit_signal("resources_changed", wood, stone, gold)
	return true

func spend_for_building(building_type: String) -> bool:
	if not can_afford(building_type):
		return false
	var cost = BUILD_COSTS[building_type]
	return spend_raw(cost.wood, cost.stone, cost.gold)

func select_building(type: String) -> void:
	if selected_building == type:
		selected_building = ""
	else:
		selected_building = type
	emit_signal("selected_building_changed", selected_building)

# --- Territory & Core Crystals ---

func register_core(core: Node2D) -> void:
	if not all_cores.has(core):
		all_cores.append(core)
	var key = "%d,%d" % [core.grid_x, core.grid_y]
	if territories.has(key):
		territories[key]["core_node"] = core
		territories[key]["unlocked"] = core.is_unlocked
		territories[key]["corrupted"] = core.is_corrupted
		territories[key]["tier"] = core.village_tier
		
	if core.is_unlocked and not core.is_corrupted:
		if not active_cores.has(core):
			active_cores.append(core)
	else:
		active_cores.erase(core)
		
	emit_signal("core_registered", core)
	emit_signal("territory_changed")

func notify_core_state_changed(core: Node2D) -> void:
	var key = "%d,%d" % [core.grid_x, core.grid_y]
	if territories.has(key):
		territories[key]["unlocked"] = core.is_unlocked
		territories[key]["corrupted"] = core.is_corrupted
		territories[key]["tier"] = core.village_tier
		
	if core.is_unlocked and not core.is_corrupted:
		if not active_cores.has(core):
			active_cores.append(core)
	else:
		active_cores.erase(core)
		if core.is_capital and core.is_corrupted:
			# 중심 수도 마을의 코어 보석이 부숴지면 즉시 패배
			defeat()
			return
			
	emit_signal("territory_changed")

func is_in_territory(pos: Vector2) -> bool:
	for core in active_cores:
		if is_instance_valid(core) and core.is_unlocked and not core.is_corrupted:
			if pos.distance_to(core.global_position) <= core.get_radius():
				return true
	return false

func get_territory_buff_at(pos: Vector2) -> Dictionary:
	var best_dmg: float = 1.0
	var best_rng: float = 1.0
	for core in active_cores:
		if is_instance_valid(core) and core.is_unlocked and not core.is_corrupted:
			if pos.distance_to(core.global_position) <= core.get_radius():
				var cfg = VILLAGE_TIERS.get(core.village_tier, VILLAGE_TIERS["outpost"])
				best_dmg = max(best_dmg, cfg.damage_mult)
				best_rng = max(best_rng, cfg.range_mult)
	return {"damage_mult": best_dmg, "range_mult": best_rng}

func get_closest_active_core(pos: Vector2) -> Node2D:
	var closest: Node2D = null
	var min_dist: float = INF
	for core in active_cores:
		if is_instance_valid(core) and core.is_unlocked and not core.is_corrupted:
			var dist = pos.distance_to(core.global_position)
			if dist < min_dist:
				min_dist = dist
				closest = core
	return closest

func get_capital_core() -> Node2D:
	for core in all_cores:
		if is_instance_valid(core) and core.is_capital:
			return core
	return null

func get_outermost_active_core() -> Node2D:
	if active_cores.is_empty():
		return get_capital_core()
	# 점령한 땅 중 외곽 영토를 우선 선택
	var outer_cores: Array[Node2D] = []
	var max_dist: int = -1
	for core in active_cores:
		if is_instance_valid(core):
			var d = abs(core.grid_x) + abs(core.grid_y)
			if d > max_dist:
				max_dist = d
				outer_cores = [core]
			elif d == max_dist:
				outer_cores.append(core)
	return outer_cores.pick_random() if not outer_cores.is_empty() else active_cores[0]

# --- Game Outcomes & Meta Rewards ---

func victory() -> void:
	is_game_active = false
	has_next_mission_advantage = true
	if not unlocked_costumes.has("황금 왕관 개척자 (Yellow Pawn)"):
		unlocked_costumes.append("황금 왕관 개척자 (Yellow Pawn)")
	if session_mode_minutes == 60 and not unlocked_costumes.has("자수정 성기사 (Purple Pawn)"):
		unlocked_costumes.append("자수정 성기사 (Purple Pawn)")
	emit_signal("meta_reward_unlocked", has_next_mission_advantage, unlocked_costumes.back())
	emit_signal("game_over", true)

func defeat() -> void:
	is_game_active = false
	emit_signal("game_over", false)
