extends StaticBody2D
class_name ResourceNode

## ResourceNode
## Harvestable objects like Trees, Rocks, and Gold veins with gentle ambient animations.

@export_enum("wood", "stone", "gold") var resource_type: String = "wood"
@export var max_harvests: int = 5
@export var yield_per_hit: int = 2

var remaining_harvests: int = 5
var anim_timer: float = 0.0
var current_frame: int = 0

@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("resources")
	remaining_harvests = max_harvests
	
	# Randomize initial frame so all trees don't sway in lockstep
	if sprite and sprite.hframes > 1:
		current_frame = randi() % sprite.hframes
		sprite.frame = current_frame

func _process(delta: float) -> void:
	if sprite and sprite.hframes > 1:
		anim_timer += delta
		if anim_timer >= 0.14: # Gentle ambient wind
			anim_timer = 0.0
			current_frame = (current_frame + 1) % sprite.hframes
			sprite.frame = current_frame

func harvest(amount: int = 1) -> void:
	if remaining_harvests <= 0:
		return
		
	remaining_harvests -= amount
	if GameManager:
		GameManager.add_resource(resource_type, yield_per_hit)
		
	# Shake/bounce effect
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "rotation_degrees", 8.0, 0.05)
		tween.tween_property(sprite, "rotation_degrees", -8.0, 0.05)
		tween.tween_property(sprite, "rotation_degrees", 0.0, 0.05)
		
	if remaining_harvests <= 0:
		queue_free()
