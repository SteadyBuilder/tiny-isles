extends StaticBody2D
class_name CoreCrystal

## CoreCrystal
## The heart of a settlement. Provides territory protection, activates towers,
## and must be defended against invading goblin waves.

signal health_changed(current: float, max: float)

@export var max_health: float = 500.0
@export var territory_radius: float = 350.0
var current_health: float = 500.0
var is_destroyed: bool = false

@onready var light: PointLight2D = $PointLight2D if has_node("PointLight2D") else null
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null
@onready var health_bar: ProgressBar = $HealthBar if has_node("HealthBar") else null

func _ready() -> void:
	add_to_group("core_crystals")
	add_to_group("defend_targets")
	current_health = max_health
	
	if health_bar:
		health_bar.max_value = max_health
		health_bar.value = current_health
		
	if GameManager:
		GameManager.register_core(self)

func get_radius() -> float:
	return territory_radius

func take_damage(amount: float) -> void:
	if is_destroyed:
		return
		
	current_health = max(0.0, current_health - amount)
	emit_signal("health_changed", current_health, max_health)
	
	if health_bar:
		health_bar.value = current_health
		
	# Damage flash
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1, 0.2, 0.2), 0.1)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.15)
		
	if current_health <= 0.0:
		destroy()

func destroy() -> void:
	is_destroyed = true
	if light:
		var tween = create_tween()
		tween.tween_property(light, "energy", 0.0, 1.0)
		
	if GameManager:
		GameManager.unregister_core(self)
		
	# Leave ruined crystal or despawn after delay
	queue_free()
