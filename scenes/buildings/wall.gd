extends StaticBody2D
class_name DefenseWall

## DefenseWall
## Basic barrier to block enemy pathing and protect settlement cores.

@export var max_health: float = 120.0
var current_health: float = 120.0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("walls")
	add_to_group("defend_targets")
	current_health = max_health

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1, 0.4, 0.4), 0.1)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)
	if current_health <= 0.0:
		queue_free()
