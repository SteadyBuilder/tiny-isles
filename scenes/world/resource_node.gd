extends StaticBody2D
class_name ResourceNode

## ResourceNode
## 나무(wood), 석재 바위(stone), 희귀 금광(gold) 자원 노드

@export_enum("wood", "stone", "gold") var resource_type: String = "wood"
@export var max_harvests: int = 6
@export var yield_per_hit: int = 3

var remaining_harvests: int = 6
var anim_timer: float = 0.0
var current_frame: int = 0

var tex_tree = preload("res://assets/tiny_swords/Terrain/Resources/Wood/Trees/Tree1.png")
var tex_rock = preload("res://assets/tiny_swords/Terrain/Decorations/Rocks/Rock2.png")
var tex_gold = preload("res://assets/tiny_swords/Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png")

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("resources")
	configure_resource(resource_type)

func configure_resource(r_type: String) -> void:
	resource_type = r_type
	if not sprite:
		return
	match resource_type:
		"stone":
			sprite.texture = tex_rock
			sprite.hframes = 1
			sprite.vframes = 1
			sprite.offset = Vector2(0, -16)
			sprite.scale = Vector2(1.25, 1.25)
			max_harvests = 6
			yield_per_hit = 3
		"gold":
			sprite.texture = tex_gold
			sprite.hframes = 1
			sprite.vframes = 1
			sprite.offset = Vector2(0, -20)
			sprite.scale = Vector2(1.05, 1.05)
			max_harvests = 5
			yield_per_hit = 2
		_: # "wood"
			sprite.texture = tex_tree
			sprite.hframes = 8
			sprite.vframes = 1
			sprite.offset = Vector2(0, -80)
			sprite.scale = Vector2(1.0, 1.0)
			max_harvests = 7
			yield_per_hit = 3
			current_frame = randi() % 8
			sprite.frame = current_frame
	remaining_harvests = max_harvests

func _process(delta: float) -> void:
	if sprite and sprite.hframes > 1:
		anim_timer += delta
		if anim_timer >= 0.14:
			anim_timer = 0.0
			current_frame = (current_frame + 1) % sprite.hframes
			sprite.frame = current_frame

func harvest(amount: int = 1) -> void:
	if remaining_harvests <= 0:
		return
		
	remaining_harvests -= amount
	if GameManager:
		GameManager.add_resource(resource_type, yield_per_hit)
		
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "rotation_degrees", 8.0, 0.05)
		tween.tween_property(sprite, "rotation_degrees", -8.0, 0.05)
		tween.tween_property(sprite, "rotation_degrees", 0.0, 0.05)
		
	if remaining_harvests <= 0:
		queue_free()
