extends CanvasLayer
class_name GameHUD

## GameHUD - 모바일 & PC 반응형 통합 UI
## 1. 초슬림 상단 게임 바 (수도 코어 HP, 플레이어 HP, 세션 타이머, 웨이브 카운트다운/조기 소환, 자원, 건축 토글, 미니맵 토글)
## 2. 오프스크린 침공 방향 경고 배너 (외곽 마물 진입 방향 표시)
## 3. 모바일 전용 듀얼 터치 컨트롤러 (좌하단 플로팅 다이내믹 조이스틱 + 우하단 스마트 오토타겟 연속 타격 버튼 + 대시 + 상황별 상호작용 팝업)
## 4. 썸 프렌들리(Thumb-friendly) 건축 핫바 (나무 방책, 석재 성벽, 화살 타워, 공성 대포탑)
## 5. 5x5 영토 전체 미니맵 모달 & 방 생성(30분/60분 세션 선택) 및 미션 완수 보상(어드밴티지/코스튬) 모달

@onready var wood_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/WoodLabel
@onready var stone_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/StoneLabel
@onready var gold_label: Label = $TopBar/CapsulePanel/HBox/ResourceContainer/GoldLabel
@onready var wave_label: Label = $TopBar/CapsulePanel/HBox/WaveContainer/WaveLabel
@onready var timer_label: Label = $TopBar/CapsulePanel/HBox/WaveContainer/TimerLabel

# 동적 생성 UI 참조
var core_hp_label: Label
var player_hp_label: Label
var early_wave_btn: Button
var warning_banner: PanelContainer
var warning_label: Label

# 하단 건축 핫바
var build_hotbar_panel: PanelContainer
var build_buttons: Dictionary = {}
var is_hotbar_open: bool = false

# 모바일 컨트롤러
var joystick_touch_zone: Control
var joystick_base: Control
var joystick_knob: Panel
var joystick_hint: Label
var active_joy_touch_idx: int = -1
var joy_center: Vector2 = Vector2.ZERO
const JOY_MAX_RADIUS: float = 52.0

var contextual_btn: Button
var build_action_btn: Button
var dash_btn: Button
var attack_btn: Button
var is_attack_held: bool = false
var attack_hold_timer: float = 0.0

# 모달 (방 생성 30분/60분 선택 & 결과 보상, 5x5 미니맵)
var session_modal: Control
var session_title_lbl: Label
var session_desc_lbl: Label
var session_reward_box: VBoxContainer
var mode_buttons_box: VBoxContainer
var restart_btn: Button
var costume_btn: Button

var minimap_modal: Control
var minimap_grid: GridContainer
var minimap_detail_lbl: Label

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_upgrade_top_bar()
	_create_warning_banner()
	_create_build_hotbar()
	_create_mobile_controls()
	_create_minimap_modal()
	_create_session_modal()
	
	if GameManager:
		GameManager.resources_changed.connect(_on_resources_changed)
		GameManager.wave_state_changed.connect(_on_wave_state_changed)
		GameManager.warning_direction_changed.connect(_on_warning_direction_changed)
		GameManager.contextual_prompt_changed.connect(_on_contextual_prompt_changed)
		GameManager.selected_building_changed.connect(_on_selected_building_changed)
		GameManager.game_over.connect(_on_game_over)
		GameManager.territory_changed.connect(_refresh_minimap)
		_on_resources_changed(GameManager.wood, GameManager.stone, GameManager.gold)

	var player = get_tree().get_first_node_in_group("player")
	if player and player.has_signal("health_changed"):
		player.health_changed.connect(_on_player_health_changed)

func _process(delta: float) -> void:
	# 메인 공격/채집 버튼 홀드 시 연속 스마트 타격
	if is_attack_held:
		attack_hold_timer -= delta
		if attack_hold_timer <= 0.0:
			attack_hold_timer = 0.18
			_trigger_player_smart_action()
			
	# 수도 코어 체력 실시간 표시
	if core_hp_label and GameManager:
		var cap = GameManager.get_capital_core()
		if is_instance_valid(cap):
			core_hp_label.text = "💎 %d/%d" % [int(cap.current_health), int(cap.max_health)]

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_1:
				GameManager.select_building("fence")
				_set_hotbar_open(true)
			KEY_2:
				GameManager.select_building("wall")
				_set_hotbar_open(true)
			KEY_3:
				GameManager.select_building("arrow_tower")
				_set_hotbar_open(true)
			KEY_4:
				GameManager.select_building("cannon_tower")
				_set_hotbar_open(true)
			KEY_B, KEY_Q:
				_set_hotbar_open(not is_hotbar_open)
			KEY_M:
				minimap_modal.visible = not minimap_modal.visible
				if minimap_modal.visible:
					_refresh_minimap()

# -------------------------------------------------------------------------
# 1. 상단 컴팩트 캡슐 바 업그레이드
# -------------------------------------------------------------------------
func _upgrade_top_bar() -> void:
	var hbox = $TopBar/CapsulePanel/HBox
	var old_hotbar = hbox.get_node_or_null("BuildHotbar")
	if old_hotbar:
		old_hotbar.visible = false
		
	var capsule = $TopBar/CapsulePanel as PanelContainer
	capsule.offset_left = -540.0
	capsule.offset_right = 540.0
	
	# 좌측 코어 & 플레이어 체력 표시 추가
	var status_box = HBoxContainer.new()
	status_box.add_theme_constant_override("separation", 10)
	
	core_hp_label = Label.new()
	core_hp_label.text = "💎 500/500"
	core_hp_label.add_theme_font_size_override("font_size", 13)
	core_hp_label.add_theme_color_override("font_color", Color(0.35, 0.92, 1.0))
	status_box.add_child(core_hp_label)
	
	player_hp_label = Label.new()
	player_hp_label.text = "❤️ 120"
	player_hp_label.add_theme_font_size_override("font_size", 13)
	player_hp_label.add_theme_color_override("font_color", Color(1.0, 0.45, 0.55))
	status_box.add_child(player_hp_label)
	
	hbox.add_child(status_box)
	hbox.move_child(status_box, 0)
	
	# 조기 웨이브 소환 버튼
	var wave_box = $TopBar/CapsulePanel/HBox/WaveContainer
	early_wave_btn = Button.new()
	early_wave_btn.text = "⚡조기호출"
	early_wave_btn.add_theme_font_size_override("font_size", 11)
	early_wave_btn.pressed.connect(func():
		if GameManager:
			GameManager.call_wave_early()
	)
	wave_box.add_child(early_wave_btn)
	
	# 우측 유틸 버튼 (🔨건설, 🗺️지도)
	var util_box = HBoxContainer.new()
	util_box.add_theme_constant_override("separation", 6)
	
	var btn_build = Button.new()
	btn_build.text = "🔨 건축(B)"
	btn_build.add_theme_font_size_override("font_size", 12)
	btn_build.pressed.connect(func(): _set_hotbar_open(not is_hotbar_open))
	util_box.add_child(btn_build)
	
	var btn_map = Button.new()
	btn_map.text = "🗺️ 지도(M)"
	btn_map.add_theme_font_size_override("font_size", 12)
	btn_map.pressed.connect(func():
		minimap_modal.visible = not minimap_modal.visible
		if minimap_modal.visible:
			_refresh_minimap()
	)
	util_box.add_child(btn_map)
	
	hbox.add_child(util_box)

func _create_warning_banner() -> void:
	warning_banner = PanelContainer.new()
	warning_banner.visible = false
	warning_banner.anchors_preset = Control.PRESET_CENTER_TOP
	warning_banner.anchor_left = 0.5
	warning_banner.anchor_right = 0.5
	warning_banner.offset_left = -210.0
	warning_banner.offset_right = 210.0
	warning_banner.offset_top = 48.0
	warning_banner.offset_bottom = 76.0
	
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.75, 0.12, 0.18, 0.90)
	sb.corner_radius_top_left = 14
	sb.corner_radius_top_right = 14
	sb.corner_radius_bottom_left = 14
	sb.corner_radius_bottom_right = 14
	sb.border_width_left = 1
	sb.border_width_top = 1
	sb.border_width_right = 1
	sb.border_width_bottom = 1
	sb.border_color = Color(1.0, 0.6, 0.6)
	warning_banner.add_theme_stylebox_override("panel", sb)
	
	warning_label = Label.new()
	warning_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	warning_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	warning_label.add_theme_font_size_override("font_size", 12)
	warning_label.text = "⚠️ 외곽 방향에서 마물 웨이브 침공 중!"
	warning_banner.add_child(warning_label)
	add_child(warning_banner)

# -------------------------------------------------------------------------
# 2. 썸 프렌들리(Thumb-Friendly) 하단 건축 핫바
# -------------------------------------------------------------------------
func _create_build_hotbar() -> void:
	build_hotbar_panel = PanelContainer.new()
	build_hotbar_panel.visible = false
	build_hotbar_panel.anchors_preset = Control.PRESET_CENTER_BOTTOM
	build_hotbar_panel.anchor_left = 0.5
	build_hotbar_panel.anchor_right = 0.5
	build_hotbar_panel.anchor_top = 1.0
	build_hotbar_panel.anchor_bottom = 1.0
	build_hotbar_panel.offset_left = -260.0
	build_hotbar_panel.offset_right = 260.0
	build_hotbar_panel.offset_top = -125.0
	build_hotbar_panel.offset_bottom = -20.0
	
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.07, 0.10, 0.16, 0.92)
	sb.border_color = Color(0.95, 0.70, 0.25, 0.65)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 18
	sb.corner_radius_top_right = 18
	sb.corner_radius_bottom_left = 18
	sb.corner_radius_bottom_right = 18
	sb.content_margin_left = 12
	sb.content_margin_right = 12
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	build_hotbar_panel.add_theme_stylebox_override("panel", sb)
	
	var vbox = VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	build_hotbar_panel.add_child(vbox)
	
	var title = Label.new()
	title.text = "🔨 방어 시설 건축 (선택 후 우측 [설치] 탭 또는 클릭)"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 11)
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	vbox.add_child(title)
	
	var hbox = HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 8)
	vbox.add_child(hbox)
	
	var items = [
		{"id": "fence", "label": "🪵 나무방책\n(5목재)"},
		{"id": "wall", "label": "🧱 석재성벽\n(12석재)"},
		{"id": "arrow_tower", "label": "🏹 화살타워\n(15목 10석)"},
		{"id": "cannon_tower", "label": "💣 공성포탑\n(10목 25석 8금)"}
	]
	for item in items:
		var btn = Button.new()
		btn.custom_minimum_size = Vector2(112, 56)
		btn.text = item.label
		btn.add_theme_font_size_override("font_size", 11)
		var b_id = item.id
		btn.pressed.connect(func():
			if GameManager:
				GameManager.select_building(b_id)
		)
		hbox.add_child(btn)
		build_buttons[b_id] = btn
		
	add_child(build_hotbar_panel)

func _set_hotbar_open(open: bool) -> void:
	is_hotbar_open = open
	if build_hotbar_panel:
		build_hotbar_panel.visible = open
	if not open and GameManager and GameManager.selected_building != "":
		GameManager.select_building("")

func _on_selected_building_changed(b_type: String) -> void:
	for k in build_buttons.keys():
		var btn: Button = build_buttons[k]
		btn.modulate = Color(1.2, 1.1, 0.5) if (k == b_type) else Color.WHITE
	if build_action_btn:
		build_action_btn.text = "✅ 전방 설치" if b_type != "" else "🔨 건축"
		build_action_btn.modulate = Color(0.4, 1.0, 0.55) if b_type != "" else Color.WHITE

# -------------------------------------------------------------------------
# 3. 모바일 친화적 듀얼 패드 컨트롤 (플로팅 조이스틱 + 우측 액션 클러스터)
# -------------------------------------------------------------------------
func _create_mobile_controls() -> void:
	# A. 좌하단 플로팅 조이스틱 터치 영역 (화면 왼쪽 절반)
	joystick_touch_zone = Control.new()
	joystick_touch_zone.name = "FloatingJoystickZone"
	joystick_touch_zone.anchor_left = 0.0
	joystick_touch_zone.anchor_top = 0.25
	joystick_touch_zone.anchor_right = 0.45
	joystick_touch_zone.anchor_bottom = 1.0
	joystick_touch_zone.gui_input.connect(_on_joystick_zone_input)
	add_child(joystick_touch_zone)
	
	joystick_hint = Label.new()
	joystick_hint.text = "🕹️ 이동 조이스틱\n(아무 곳이나 터치)"
	joystick_hint.position = Vector2(36, 380)
	joystick_hint.add_theme_font_size_override("font_size", 11)
	joystick_hint.modulate = Color(1, 1, 1, 0.38)
	joystick_touch_zone.add_child(joystick_hint)
	
	joystick_base = Control.new()
	joystick_base.visible = false
	joystick_touch_zone.add_child(joystick_base)
	
	var base_ring = Panel.new()
	base_ring.size = Vector2(104, 104)
	base_ring.position = Vector2(-52, -52)
	base_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var ring_sb = StyleBoxFlat.new()
	ring_sb.bg_color = Color(0.08, 0.12, 0.20, 0.55)
	ring_sb.border_color = Color(1.0, 0.80, 0.30, 0.75)
	ring_sb.border_width_left = 2
	ring_sb.border_width_top = 2
	ring_sb.border_width_right = 2
	ring_sb.border_width_bottom = 2
	ring_sb.corner_radius_top_left = 52
	ring_sb.corner_radius_top_right = 52
	ring_sb.corner_radius_bottom_left = 52
	ring_sb.corner_radius_bottom_right = 52
	base_ring.add_theme_stylebox_override("panel", ring_sb)
	joystick_base.add_child(base_ring)
	
	joystick_knob = Panel.new()
	joystick_knob.size = Vector2(44, 44)
	joystick_knob.position = Vector2(-22, -22)
	joystick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var knob_sb = StyleBoxFlat.new()
	knob_sb.bg_color = Color(1.0, 0.78, 0.25, 0.92)
	knob_sb.corner_radius_top_left = 22
	knob_sb.corner_radius_top_right = 22
	knob_sb.corner_radius_bottom_left = 22
	knob_sb.corner_radius_bottom_right = 22
	joystick_knob.add_theme_stylebox_override("panel", knob_sb)
	joystick_base.add_child(joystick_knob)

	# B. 우하단 액션 클러스터 (상황별 상호작용 + 대시/설치 + 대형 연속 타격/채집 버튼)
	var right_cluster = VBoxContainer.new()
	right_cluster.anchors_preset = Control.PRESET_BOTTOM_RIGHT
	right_cluster.anchor_left = 1.0
	right_cluster.anchor_top = 1.0
	right_cluster.anchor_right = 1.0
	right_cluster.anchor_bottom = 1.0
	right_cluster.offset_left = -260.0
	right_cluster.offset_top = -230.0
	right_cluster.offset_right = -20.0
	right_cluster.offset_bottom = -20.0
	right_cluster.alignment = BoxContainer.ALIGNMENT_END
	right_cluster.add_theme_constant_override("separation", 10)
	add_child(right_cluster)
	
	# 1) 상황 반응형 상호작용 버튼 (코어 점령 / 마을 발전 / 코어 수리)
	contextual_btn = Button.new()
	contextual_btn.visible = false
	contextual_btn.custom_minimum_size = Vector2(230, 44)
	contextual_btn.text = "✨ 코어 점령 / 마을 발전 (E)"
	contextual_btn.add_theme_font_size_override("font_size", 12)
	contextual_btn.modulate = Color(0.45, 0.95, 1.0)
	contextual_btn.pressed.connect(func():
		Input.vibrate_handheld(25)
		var player = get_tree().get_first_node_in_group("player")
		if player and player.has_method("perform_contextual_interact"):
			player.perform_contextual_interact()
	)
	right_cluster.add_child(contextual_btn)
	
	# 2) 보조 버튼 행 (건축/즉시설치 + 회피 대시)
	var sub_row = HBoxContainer.new()
	sub_row.alignment = BoxContainer.ALIGNMENT_END
	sub_row.add_theme_constant_override("separation", 10)
	right_cluster.add_child(sub_row)
	
	build_action_btn = Button.new()
	build_action_btn.custom_minimum_size = Vector2(96, 48)
	build_action_btn.text = "🔨 건축"
	build_action_btn.add_theme_font_size_override("font_size", 13)
	build_action_btn.pressed.connect(func():
		Input.vibrate_handheld(18)
		if GameManager and GameManager.selected_building != "":
			var player = get_tree().get_first_node_in_group("player")
			if player and player.has_method("perform_build_selected"):
				player.perform_build_selected()
		else:
			_set_hotbar_open(not is_hotbar_open)
	)
	sub_row.add_child(build_action_btn)
	
	dash_btn = Button.new()
	dash_btn.custom_minimum_size = Vector2(96, 48)
	dash_btn.text = "🛡️ 대시"
	dash_btn.add_theme_font_size_override("font_size", 13)
	dash_btn.pressed.connect(func():
		Input.vibrate_handheld(20)
		var player = get_tree().get_first_node_in_group("player")
		if player and player.has_method("perform_dash"):
			player.perform_dash()
	)
	sub_row.add_child(dash_btn)
	
	# 3) 메인 공격/채집 버튼 (홀드 연속 오토 타겟팅 지원)
	var atk_row = HBoxContainer.new()
	atk_row.alignment = BoxContainer.ALIGNMENT_END
	right_cluster.add_child(atk_row)
	
	attack_btn = Button.new()
	attack_btn.custom_minimum_size = Vector2(145, 72)
	attack_btn.text = "⚔️ 공격 / 채집\n(누르고 있으면 연속)"
	attack_btn.add_theme_font_size_override("font_size", 13)
	attack_btn.modulate = Color(1.0, 0.72, 0.55)
	attack_btn.button_down.connect(func():
		is_attack_held = true
		attack_hold_timer = 0.0
		Input.vibrate_handheld(12)
		_trigger_player_smart_action()
	)
	attack_btn.button_up.connect(func():
		is_attack_held = false
	)
	atk_row.add_child(attack_btn)

func _on_joystick_zone_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed and active_joy_touch_idx == -1:
			active_joy_touch_idx = event.index
			joy_center = event.position
			joystick_base.position = joy_center
			joystick_knob.position = Vector2(-22, -22)
			joystick_base.visible = true
			joystick_hint.visible = false
			if GameManager:
				GameManager.mobile_joystick_vector = Vector2.ZERO
		elif not event.pressed and event.index == active_joy_touch_idx:
			_reset_joystick()
	elif event is InputEventScreenDrag and event.index == active_joy_touch_idx:
		_update_joystick_drag(event.position)
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			active_joy_touch_idx = 0
			joy_center = event.position
			joystick_base.position = joy_center
			joystick_knob.position = Vector2(-22, -22)
			joystick_base.visible = true
			joystick_hint.visible = false
		else:
			_reset_joystick()
	elif event is InputEventMouseMotion and active_joy_touch_idx == 0:
		_update_joystick_drag(event.position)

func _update_joystick_drag(pos: Vector2) -> void:
	var delta_vec = pos - joy_center
	var dist = delta_vec.length()
	var clamped = delta_vec
	if dist > JOY_MAX_RADIUS:
		clamped = (delta_vec / dist) * JOY_MAX_RADIUS
	joystick_knob.position = clamped - Vector2(22, 22)
	if GameManager:
		GameManager.mobile_joystick_vector = (clamped / JOY_MAX_RADIUS) if dist > 6.0 else Vector2.ZERO

func _reset_joystick() -> void:
	active_joy_touch_idx = -1
	joystick_base.visible = false
	joystick_hint.visible = true
	if GameManager:
		GameManager.mobile_joystick_vector = Vector2.ZERO

func _trigger_player_smart_action() -> void:
	var player = get_tree().get_first_node_in_group("player")
	if player and player.has_method("perform_smart_action"):
		player.perform_smart_action()

# -------------------------------------------------------------------------
# 4. 5x5 영토 전체 지도 (Minimap Modal)
# -------------------------------------------------------------------------
func _create_minimap_modal() -> void:
	minimap_modal = Control.new()
	minimap_modal.visible = false
	minimap_modal.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(minimap_modal)
	
	var bg = ColorRect.new()
	bg.color = Color(0, 0, 0, 0.72)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	minimap_modal.add_child(bg)
	
	var panel = PanelContainer.new()
	panel.anchors_preset = Control.PRESET_CENTER
	panel.anchor_left = 0.5
	panel.anchor_top = 0.5
	panel.anchor_right = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -250.0
	panel.offset_top = -230.0
	panel.offset_right = 250.0
	panel.offset_bottom = 230.0
	
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.13, 0.22, 0.96)
	sb.border_color = Color(0.95, 0.75, 0.30, 0.8)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 20
	sb.corner_radius_top_right = 20
	sb.corner_radius_bottom_left = 20
	sb.corner_radius_bottom_right = 20
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 14
	sb.content_margin_bottom = 14
	panel.add_theme_stylebox_override("panel", sb)
	minimap_modal.add_child(panel)
	
	var vbox = VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 10)
	panel.add_child(vbox)
	
	var header = HBoxContainer.new()
	var title = Label.new()
	title.text = "🗺️ 왕국 영토 현황 (5x5 마을 그리드)"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.add_theme_font_size_override("font_size", 16)
	title.add_theme_color_override("font_color", Color(1.0, 0.85, 0.4))
	header.add_child(title)
	
	var close_btn = Button.new()
	close_btn.text = "닫기 ✕"
	close_btn.pressed.connect(func(): minimap_modal.visible = false)
	header.add_child(close_btn)
	vbox.add_child(header)
	
	minimap_grid = GridContainer.new()
	minimap_grid.columns = 5
	minimap_grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	minimap_grid.add_theme_constant_override("h_separation", 6)
	minimap_grid.add_theme_constant_override("v_separation", 6)
	vbox.add_child(minimap_grid)
	
	minimap_detail_lbl = Label.new()
	minimap_detail_lbl.text = "영토 타일을 눌러 마을 등급과 점령 상태를 확인하세요."
	minimap_detail_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	minimap_detail_lbl.add_theme_font_size_override("font_size", 12)
	vbox.add_child(minimap_detail_lbl)

func _refresh_minimap() -> void:
	if not minimap_grid or not GameManager:
		return
	for c in minimap_grid.get_children():
		c.queue_free()
		
	for gy in range(-2, 3):
		for gx in range(-2, 3):
			var key = "%d,%d" % [gx, gy]
			var info = GameManager.territories.get(key, {})
			var btn = Button.new()
			btn.custom_minimum_size = Vector2(78, 52)
			btn.add_theme_font_size_override("font_size", 10)
			
			var icon = "🔒"
			if info.get("is_capital", false):
				icon = "👑수도"
				btn.modulate = Color(0.45, 0.85, 1.0)
			elif info.get("corrupted", false):
				icon = "💀오염"
				btn.modulate = Color(1.0, 0.4, 0.4)
			elif info.get("unlocked", false):
				var tier_id = info.get("tier", "outpost")
				var tier_name = GameManager.VILLAGE_TIERS.get(tier_id, {}).get("name", "마을")
				icon = "🏰" + tier_name
				btn.modulate = Color(0.45, 1.0, 0.65)
			else:
				icon = "🔒(%d,%d)" % [gx, gy]
				btn.modulate = Color(0.75, 0.78, 0.85)
				
			btn.text = icon
			btn.pressed.connect(func():
				var t_name = info.get("name", key)
				var tier_id = info.get("tier", "outpost")
				var tier_name = GameManager.VILLAGE_TIERS.get(tier_id, {}).get("name", "야영지")
				var status_txt = "점령됨 (%s)" % tier_name if info.get("unlocked", false) else "미점령 (🌲%d 🪨%d)" % [info.get("cost_wood", 15), info.get("cost_stone", 10)]
				if info.get("corrupted", false):
					status_txt = "코어 파괴됨 (재정화 필요)"
				minimap_detail_lbl.text = "📍 %s : %s" % [t_name, status_txt]
			)
			minimap_grid.add_child(btn)

# -------------------------------------------------------------------------
# 5. 방 생성 (30분 / 60분 세션 선택) 및 미션 완수 보상 모달
# -------------------------------------------------------------------------
func _create_session_modal() -> void:
	session_modal = Control.new()
	session_modal.visible = true
	session_modal.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(session_modal)
	
	var bg = ColorRect.new()
	bg.color = Color(0.02, 0.04, 0.08, 0.82)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	session_modal.add_child(bg)
	
	var panel = PanelContainer.new()
	panel.anchors_preset = Control.PRESET_CENTER
	panel.anchor_left = 0.5
	panel.anchor_top = 0.5
	panel.anchor_right = 0.5
	panel.anchor_bottom = 0.5
	panel.offset_left = -240.0
	panel.offset_top = -195.0
	panel.offset_right = 240.0
	panel.offset_bottom = 195.0
	
	var sb = StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.12, 0.20, 0.98)
	sb.border_color = Color(1.0, 0.78, 0.28, 0.85)
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.corner_radius_top_left = 22
	sb.corner_radius_top_right = 22
	sb.corner_radius_bottom_left = 22
	sb.corner_radius_bottom_right = 22
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 18
	sb.content_margin_bottom = 18
	panel.add_theme_stylebox_override("panel", sb)
	session_modal.add_child(panel)
	
	var vbox = VBoxContainer.new()
	vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)
	
	session_title_lbl = Label.new()
	session_title_lbl.text = "🛡️ 방 생성 & 디펜스 세션 선택"
	session_title_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	session_title_lbl.add_theme_font_size_override("font_size", 19)
	session_title_lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.42))
	vbox.add_child(session_title_lbl)
	
	session_desc_lbl = Label.new()
	session_desc_lbl.text = "중심 수도(중소마을+나무방책)에서 시작하여 영토를 넓히고\n외곽에서 몰려오는 좀비·스켈레톤·보스 웨이브로부터 코어 보석을 수호하세요!"
	session_desc_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	session_desc_lbl.add_theme_font_size_override("font_size", 12)
	session_desc_lbl.add_theme_color_override("font_color", Color(0.82, 0.88, 0.96))
	vbox.add_child(session_desc_lbl)
	
	# 코스튬 스킨 전환 버튼
	costume_btn = Button.new()
	costume_btn.text = "👕 장착 코스튬: 기본 개척자 (Blue Pawn)"
	costume_btn.add_theme_font_size_override("font_size", 12)
	costume_btn.pressed.connect(_cycle_costume)
	vbox.add_child(costume_btn)
	
	mode_buttons_box = VBoxContainer.new()
	mode_buttons_box.add_theme_constant_override("separation", 10)
	vbox.add_child(mode_buttons_box)
	
	var btn_30 = Button.new()
	btn_30.custom_minimum_size = Vector2(400, 56)
	btn_30.text = "⏱️ [30분 모드] 속전속결 세션 시작\n(빠른 영토 확장 + 일반 웨이브 & 중간 보스전)"
	btn_30.add_theme_font_size_override("font_size", 13)
	btn_30.modulate = Color(0.55, 1.0, 0.72)
	btn_30.pressed.connect(func(): _start_game_mode(30))
	mode_buttons_box.add_child(btn_30)
	
	var btn_60 = Button.new()
	btn_60.custom_minimum_size = Vector2(400, 56)
	btn_60.text = "💀 [60분 모드] 대서사시 / 하드코어 세션 시작\n(대도시 육성 + 30분 중간보스 & 60분 월드보스 강림)"
	btn_60.add_theme_font_size_override("font_size", 13)
	btn_60.modulate = Color(0.72, 0.82, 1.0)
	btn_60.pressed.connect(func(): _start_game_mode(60))
	mode_buttons_box.add_child(btn_60)
	
	session_reward_box = VBoxContainer.new()
	session_reward_box.visible = false
	vbox.add_child(session_reward_box)
	
	var reward_lbl = Label.new()
	reward_lbl.name = "RewardLabel"
	reward_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	reward_lbl.add_theme_font_size_override("font_size", 13)
	reward_lbl.add_theme_color_override("font_color", Color(0.45, 1.0, 0.65))
	session_reward_box.add_child(reward_lbl)
	
	restart_btn = Button.new()
	restart_btn.visible = false
	restart_btn.custom_minimum_size = Vector2(360, 48)
	restart_btn.text = "🔄 새로운 방 생성 / 다시 시작"
	restart_btn.pressed.connect(func():
		get_tree().reload_current_scene()
	)
	vbox.add_child(restart_btn)

func _cycle_costume() -> void:
	if not GameManager or GameManager.unlocked_costumes.is_empty():
		return
	var idx = GameManager.unlocked_costumes.find(GameManager.equipped_costume)
	idx = (idx + 1) % GameManager.unlocked_costumes.size()
	GameManager.equipped_costume = GameManager.unlocked_costumes[idx]
	costume_btn.text = "👕 장착 코스튬: " + GameManager.equipped_costume
	var player = get_tree().get_first_node_in_group("player")
	if player and player.has_method("set_state"):
		player.set_state(player.current_state)

func _start_game_mode(mins: int) -> void:
	session_modal.visible = false
	if GameManager:
		GameManager.start_session(mins)

func _on_game_over(victory: bool) -> void:
	session_modal.visible = true
	mode_buttons_box.visible = false
	restart_btn.visible = true
	if victory:
		session_title_lbl.text = "🏆 미션 완수! 왕국 수도 수호 성공!"
		session_desc_lbl.text = "모든 마물 웨이브와 보스를 물리치고 수도를 지켜냈습니다!"
		session_reward_box.visible = true
		var r_lbl = session_reward_box.get_node("RewardLabel") as Label
		r_lbl.text = "🎁 획득 보상:\n1) 다음 미션 어드밴티지 (시작 목재/석재 +50, 금 +20)\n2) 개인 캐릭터 꾸미기 코스튬 [황금 왕관 개척자] 해금!"
	else:
		session_title_lbl.text = "💀 수도 코어 파괴됨 - 미션 실패"
		session_desc_lbl.text = "중심 마을의 코어 보석이 부숴져 영토를 모두 잃었습니다."
		session_reward_box.visible = false

# -------------------------------------------------------------------------
# 시그널 핸들러
# -------------------------------------------------------------------------
func _on_resources_changed(wood: int, stone: int, gold: int) -> void:
	if wood_label:
		wood_label.text = "🌲 " + str(wood)
	if stone_label:
		stone_label.text = "🪨 " + str(stone)
	if gold_label:
		gold_label.text = "🪙 " + str(gold)

func _on_player_health_changed(current: float, _max_hp: float) -> void:
	if player_hp_label:
		player_hp_label.text = "❤️ %d" % int(current)

func _on_wave_state_changed(state: String, remaining: float, wave_index: int, is_boss: bool) -> void:
	var minutes = int(remaining) / 60
	var seconds = int(remaining) % 60
	var time_str = "%02d:%02d" % [minutes, seconds]
	
	if timer_label:
		timer_label.text = time_str
		
	if early_wave_btn:
		early_wave_btn.visible = (state != "INVASION")
		
	if wave_label:
		if state == "INVASION":
			wave_label.text = ("👹 보스 강림 (W%d)!" if is_boss else "⚔️ 마물 침공 (W%d)!") % wave_index
			wave_label.modulate = Color(1.0, 0.35, 0.35)
		else:
			wave_label.text = "🕊️ 정비/확장 (W%d)" % wave_index
			wave_label.modulate = Color(0.45, 0.92, 0.65)

func _on_warning_direction_changed(dir_str: String, monster_count: int) -> void:
	if not warning_banner or not warning_label:
		return
	if dir_str != "" and monster_count > 0:
		warning_banner.visible = true
		warning_label.text = "⚠️ 외곽 [%s] 방향에서 마물 %d마리 중심부로 진입 중!" % [dir_str, monster_count]
	else:
		warning_banner.visible = false

func _on_contextual_prompt_changed(prompt_type: String, label_text: String, _target_node: Node2D) -> void:
	if not contextual_btn:
		return
	if prompt_type == "" or label_text == "":
		contextual_btn.visible = false
	else:
		contextual_btn.visible = true
		contextual_btn.text = label_text
