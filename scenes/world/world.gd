extends Node2D

## World Controller
## Controls day/night cycle matching wave states, atmosphere, and lighting.

@onready var ambient_light: DirectionalLight2D = $DirectionalLight2D if has_node("DirectionalLight2D") else null

func _ready() -> void:
	if GameManager:
		GameManager.wave_state_changed.connect(_on_wave_state_changed)

func _on_wave_state_changed(state: String, _remaining: float, _wave_index: int) -> void:
	if not ambient_light:
		return
		
	var tween = create_tween()
	if state == "INVASION":
		# Shift to dark, moody night with slight crimson danger hue
		tween.tween_property(ambient_light, "color", Color(0.2, 0.22, 0.38), 3.0)
		tween.parallel().tween_property(ambient_light, "energy", 0.5, 3.0)
	else:
		# Shift to gentle daytime
		tween.tween_property(ambient_light, "color", Color(1.0, 0.98, 0.92), 3.0)
		tween.parallel().tween_property(ambient_light, "energy", 0.95, 3.0)
