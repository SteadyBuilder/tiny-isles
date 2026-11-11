# Tiny Swords Asset Pack Placement Guide

Download and extract the **Tiny Swords (by Pixel Frog)** asset pack into this folder:

```text
tiny_swords/
├── Factions/
│   ├── Knights/
│   │   ├── Buildings/
│   │   └── Troops/
│   │       ├── Archer/
│   │       ├── Pawn/
│   │       └── Warrior/
│   └── Goblins/
│       ├── Buildings/
│       └── Troops/
│           ├── Barrel/
│           ├── TNT/
│           └── Torch/
├── Resources/
│   ├── Gold/
│   ├── Sheep/
│   └── Trees/
├── Terrain/
│   ├── Bridge/
│   ├── Ground/
│   └── Water/
└── UI/
    ├── Banners/
    ├── Buttons/
    ├── Icons/
    └── Ribbons/
```

### Tips for Godot 4:
1. All spritesheets are based on a 64x64 or 192x192 tile grid.
2. In Godot 4's `Sprite2D` or `AnimatedSprite2D`, configure `Hframes` and `Vframes` to match each strip (e.g. 6 frames for Warrior Run/Idle).
3. The project setting `rendering/textures/canvas_textures/default_texture_filter` is already set to `Nearest (0)` for crisp pixel rendering.
