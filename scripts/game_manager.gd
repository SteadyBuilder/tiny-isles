extends Node

## GameManager (Singleton / Autoload)
## Manages global resources, wave timers, territory expansion, and game state.

signal resources_changed(wood: int, stone: int, gold: int)
signal wave_state_changed(state: String, time_remaining: float, wave_index: int)
signal core_registered(core_node: Node2D)
signal core_destroyed(core_node: Node2D)
signal territory_changed()
signal game_over(victory: bool)

# Resources
var wood: int = 50
var stone: int = 25
var gold: int = 10

# Wave & Game Timer
const TOTAL_SURVIVAL_TIME: float = 1800.0 # 30 minutes
var elapsed_game_time: float = 0.0
var wave_countdown: float = 60.0 # Time until next invasion
var current_wave: int = 1
var is_game_active: bool = true

# Wave states
enum WaveState { PEACE, INVASION }
var current_wave_state: WaveState = WaveState.PEACE

# Registered Core Crystals
var active_cores: Array[Node2D] = []

# Build Costs
const BUILD_COSTS = {
	"wall": {"wood": 10, "stone": 0, "gold": 0},
	"tower": {"wood": 25, "stone": 15, "gold": 0},
	"core": {"wood": 80, "stone": 40, "gold": 20}
}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	emit_signal("resources_changed", wood, stone, gold)

func _process(delta: float) -> void:
	if not is_game_active:
		return
		
	elapsed_game_time += delta
	if elapsed_game_time >= TOTAL_SURVIVAL_TIME:
		victory()
		return
		
	wave_countdown -= delta
	if wave_countdown <= 0.0:
		if current_wave_state == WaveState.PEACE:
			start_invasion()
		else:
			end_invasion()
			
	emit_signal("wave_state_changed", 
		"INVASION" if current_wave_state == WaveState.INVASION else "PEACE",
		wave_countdown,
		current_wave
	)

func start_invasion() -> void:
	current_wave_state = WaveState.INVASION
	wave_countdown = 45.0 + (current_wave * 5.0) # Invasion duration
	emit_signal("wave_state_changed", "INVASION", wave_countdown, current_wave)

func end_invasion() -> void:
	current_wave_state = WaveState.PEACE
	current_wave += 1
	wave_countdown = 90.0 # Rest and prepare duration
	emit_signal("wave_state_changed", "PEACE", wave_countdown, current_wave)

# --- Resource Management ---

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

func spend_for_building(building_type: String) -> bool:
	if not can_afford(building_type):
		return false
	var cost = BUILD_COSTS[building_type]
	wood -= cost.wood
	stone -= cost.stone
	gold -= cost.gold
	emit_signal("resources_changed", wood, stone, gold)
	return true

# --- Territory & Core Crystals ---

func register_core(core: Node2D) -> void:
	if not active_cores.has(core):
		active_cores.append(core)
		emit_signal("core_registered", core)
		emit_signal("territory_changed")

func unregister_core(core: Node2D) -> void:
	if active_cores.has(core):
		active_cores.erase(core)
		emit_signal("core_destroyed", core)
		emit_signal("territory_changed")
		if active_cores.is_empty():
			defeat()

func is_in_territory(pos: Vector2) -> bool:
	for core in active_cores:
		if is_instance_valid(core) and core.has_method("get_radius"):
			if pos.distance_to(core.global_position) <= core.get_radius():
				return true
	return false

func get_closest_core(pos: Vector2) -> Node2D:
	var closest: Node2D = null
	var min_dist: float = INF
	for core in active_cores:
		if is_instance_valid(core):
			var dist = pos.distance_to(core.global_position)
			if dist < min_dist:
				min_dist = dist
				closest = core
	return closest

# --- Game Outcomes ---

func victory() -> void:
	is_game_active = false
	emit_signal("game_over", true)

func defeat() -> void:
	is_game_active = false
	emit_signal("game_over", false)
