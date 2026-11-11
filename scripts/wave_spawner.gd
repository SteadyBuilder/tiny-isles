extends Node2D
class_name WaveSpawner

## WaveSpawner
## - 몬스터 웨이브는 점령한 땅 외곽에서부터 진입하며 중심부를 노림
## - 좀비(근접), 스켈레톤(원거리), 보스 몬스터(특정 주기/최종 웨이브) 출현
## - 침공 방향(N/S/E/W/NE/NW/SE/SW)을 계산하여 HUD 오프스크린 경고 인디케이터에 전달

@export var goblin_scene: PackedScene
@export var spawn_radius: float = 480.0
@export var spawn_interval: float = 2.0

var spawn_timer: float = 0.0
var monsters_to_spawn: int = 0
var boss_to_spawn: bool = false
var current_invasion_angle: float = 0.0

func _ready() -> void:
	if GameManager:
		GameManager.wave_state_changed.connect(_on_wave_state_changed)

func _process(delta: float) -> void:
	if not GameManager or not GameManager.is_game_active:
		return
	if GameManager.current_wave_state != GameManager.WaveState.INVASION:
		return
		
	if monsters_to_spawn > 0 or boss_to_spawn:
		spawn_timer -= delta
		if spawn_timer <= 0.0:
			spawn_timer = spawn_interval
			if boss_to_spawn:
				spawn_monster("boss")
				boss_to_spawn = false
			elif monsters_to_spawn > 0:
				var m_type = "skeleton" if (randf() < 0.38) else "zombie"
				spawn_monster(m_type)
				monsters_to_spawn -= 1

func _on_wave_state_changed(state: String, _remaining: float, wave_index: int, is_boss: bool) -> void:
	if state == "INVASION" and monsters_to_spawn <= 0 and not boss_to_spawn:
		# 새 웨이브 시작 시에만 스폰 큐 세팅
		var enemies = get_tree().get_nodes_in_group("enemies")
		if enemies.is_empty():
			monsters_to_spawn = 6 + (wave_index * 4)
			boss_to_spawn = is_boss
			spawn_timer = 0.4
			current_invasion_angle = randf() * TAU
			if GameManager:
				GameManager.current_warning_dir = _angle_to_compass(current_invasion_angle)

func _angle_to_compass(ang: float) -> String:
	var deg = fposmod(rad_to_deg(ang), 360.0)
	if deg >= 337.5 or deg < 22.5: return "동쪽(E)"
	if deg < 67.5: return "남동쪽(SE)"
	if deg < 112.5: return "남쪽(S)"
	if deg < 157.5: return "남서쪽(SW)"
	if deg < 202.5: return "서쪽(W)"
	if deg < 247.5: return "북서쪽(NW)"
	if deg < 292.5: return "북쪽(N)"
	return "북동쪽(NE)"

func spawn_monster(m_type: String) -> void:
	# 점령한 영토 중 가장 바깥 외곽 코어를 기준으로 외곽선에서 진입
	var outer_core = GameManager.get_outermost_active_core() if GameManager else null
	var center = outer_core.global_position if is_instance_valid(outer_core) else Vector2.ZERO
	
	var spread = randf_range(-0.45, 0.45)
	var angle = current_invasion_angle + spread
	var spawn_pos = center + Vector2(cos(angle), sin(angle)) * spawn_radius
	
	var monster: Node2D
	if goblin_scene:
		monster = goblin_scene.instantiate()
	else:
		var fallback_script = load("res://scenes/enemies/goblin.gd")
		var body = CharacterBody2D.new()
		body.set_script(fallback_script)
		monster = body
		
	monster.global_position = spawn_pos
	
	var entities = get_tree().get_first_node_in_group("entities")
	if entities:
		entities.add_child(monster)
	else:
		get_parent().add_child(monster)
		
	if monster.has_method("configure_monster"):
		monster.configure_monster(m_type)
