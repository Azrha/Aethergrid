"""
ULTRA-AGGRESSIVE tileset fix for Frostbound and Oceanic.
These tilesets use lighter colors that weren't caught by previous passes.
"""
import shutil
from pathlib import Path

from PIL import Image
import numpy as np


def fix_frostbound_oceanic(image_path: Path, output_path: Path):
    """Fix tilesets with lighter grey checkerboard patterns."""
    print(f"Processing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2], pixels[:, :, 3]
    
    # ULTRA-AGGRESSIVE: Any grey pixel (R ≈ G ≈ B) in range 80-250
    is_grey = (
        (np.abs(r.astype(int) - g.astype(int)) <= 12) & 
        (np.abs(g.astype(int) - b.astype(int)) <= 12) &
        (np.abs(r.astype(int) - b.astype(int)) <= 12)
    )
    
    # Wider range for ice/water tilesets
    is_in_range = (r >= 80) & (r <= 250)
    
    # Make matching pixels transparent
    is_checkered = is_grey & is_in_range
    new_alpha = np.where(is_checkered, 0, a)
    
    # Create output
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(output_path, format='PNG')
    
    orig_opaque = np.sum(a > 0)
    new_opaque = np.sum(new_alpha > 0)
    print(f"  Made {orig_opaque - new_opaque} pixels transparent")


def main():
    assets_dir = Path(__file__).parent / "src" / "assets"
    
    # Problematic tilesets
    tilesets = [
        ("tileset_frostbound_backup.png", "tileset_frostbound.png"),
        ("tileset_oceanic_backup.png", "tileset_oceanic.png"),
    ]
    
    for backup_name, output_name in tilesets:
        backup_path = assets_dir / backup_name
        output_path = assets_dir / output_name
        
        if backup_path.exists():
            fix_frostbound_oceanic(backup_path, output_path)
        else:
            print(f"Not found: {backup_name}")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
