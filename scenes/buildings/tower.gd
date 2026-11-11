extends StaticBody2D
class_name DefenseTower

## DefenseTower
## Automatically targets and shoots hostile goblins within range.
## Requires an active CoreCrystal in range to stay powered.

@export var max_health: float = 200.0
@export var attack_range: float = 220.0
@export var damage: float = 20.0
@export var fire_rate: float = 1.0 # shots per second

var current_health: float = 200.0
var fire_timer: float = 0.0
var current_target: Node2D = null

@onready var range_area: Area2D = $RangeArea if has_node("RangeArea") else null
@onready var sprite: Sprite2D = $Sprite2D if has_node("Sprite2D") else null

func _ready() -> void:
	add_to_group("towers")
	add_to_group("defend_targets")
	current_health = max_health

func _physics_process(delta: float) -> void:
	if fire_timer > 0.0:
		fire_timer -= delta
		
	# Check power from territory
	if GameManager and not GameManager.is_in_territory(global_position):
		# Tower loses power if disconnected from Core Crystal
		modulate = Color(0.6, 0.6, 0.6, 0.8)
		return
	else:
		modulate = Color.WHITE

	update_target()
	
	if current_target and fire_timer <= 0.0:
		shoot_at_target()
		fire_timer = 1.0 / fire_rate

func update_target() -> void:
	if not range_area:
		return
		
	var enemies = range_area.get_overlapping_bodies()
	var closest: Node2D = null
	var min_dist: float = INF
	
	for body in enemies:
		if body.is_in_group("enemies"):
			var dist = global_position.distance_to(body.global_position)
			if dist < min_dist:
				min_dist = dist
				closest = body
				
	current_target = closest

func shoot_at_target() -> void:
	if not is_instance_valid(current_target):
		return
		
	# Simple direct projectile or hit
	if current_target.has_method("take_damage"):
		current_target.take_damage(damage)
		
	# Flash effect on tower
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1.5, 1.5, 1.2), 0.08)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)

func take_damage(amount: float) -> void:
	current_health = max(0.0, current_health - amount)
	if sprite:
		var tween = create_tween()
		tween.tween_property(sprite, "modulate", Color(1, 0.3, 0.3), 0.1)
		tween.tween_property(sprite, "modulate", Color.WHITE, 0.1)
	if current_health <= 0.0:
		queue_free()
