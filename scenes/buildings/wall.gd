extends StaticBody2D
class_name DefenseWall

## DefenseWall
## 나무 방책(fence) 및 석재 성벽(wall) 지원

@export var building_subtype: String = "fence" # "fence" or "wall"
@export var max_health: float = 110.0
var current_health: float = 110.0

var tex_wood_fence = preload("res://assets/tiny_swords/Terrain/Resources/Wood/Wood Resource/Wood Resource.png")
var tex_stone_wall = preload("res://assets/tiny_swords/Terrain/Decorations/Rocks/Rock1.png")

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("walls")
	add_to_group("defend_targets")
	configure_building(building_subtype)

func configure_building(b_type: String) -> void:
	building_subtype = b_type
	if b_type == "wall":
		max_health = 280.0
		current_health = max_health
		if sprite:
			sprite.texture = tex_stone_wall
			sprite.modulate = Color(0.85, 0.9, 1.0)
			sprite.scale = Vector2(1.15, 1.15)
	else:
		max_health = 110.0
		current_health = max_health
		if sprite:
			sprite.texture = tex_wood_fence
			sprite.modulate = Color(0.95, 0.80, 0.60)
			sprite.scale = Vector2(1.1, 1.1)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1.6, 0.35, 0.35), 0.08)
		var base_col = Color(0.85, 0.9, 1.0) if building_subtype == "wall" else Color(0.95, 0.80, 0.60)
		tween.tween_property(sprite, "modulate", base_col, 0.12)
	if current_health <= 0.0:
		queue_free()
