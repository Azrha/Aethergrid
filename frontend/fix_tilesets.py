"""
Remove ALL grey checkered transparency background from tileset images.
AGGRESSIVE VERSION - targets all grey pixels in the transparency range.
"""
import shutil
from pathlib import Path

from PIL import Image
import numpy as np


def remove_all_grey_background(image_path: Path, output_path: Path):
    """Remove ALL grey pixels that look like checkerboard transparency."""
    print(f"Processing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:, :, 0], pixels[:, :, 1], pixels[:, :, 2], pixels[:, :, 3]
    
    # AGGRESSIVE: Any pixel where R ≈ G ≈ B (tolerance 8) and value between 100-230
    is_grey = (
        (np.abs(r.astype(int) - g.astype(int)) <= 8) & 
        (np.abs(g.astype(int) - b.astype(int)) <= 8) &
        (np.abs(r.astype(int) - b.astype(int)) <= 8)
    )
    
    # Grey values typically in checkerboard: 128-210 range
    is_in_range = (r >= 100) & (r <= 230)
    
    # Combine: grey pixels in range become transparent
    is_checkered = is_grey & is_in_range
    
    # Create new alpha channel: 0 where checkered
    new_alpha = np.where(is_checkered, 0, a)
    
    # Create output image
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    
    # Save
    output_img.save(output_path, format='PNG')
    
    # Count pixels made transparent
    orig_opaque = np.sum(a > 0)
    new_opaque = np.sum(new_alpha > 0)
    print(f"  Made {orig_opaque - new_opaque} pixels transparent")


def main():
    assets_dir = Path(__file__).parent / "src" / "assets"
    
    # Process from backups
    tilesets = [
        ("tileset_backup.png", "tileset.png"),
        ("tileset_fantasy_backup.png", "tileset_fantasy.png"),
        ("tileset_oceanic_backup.png", "tileset_oceanic.png"),
        ("tileset_frostbound_backup.png", "tileset_frostbound.png"),
        ("tileset_emberfall_backup.png", "tileset_emberfall.png"),
        ("tileset_dino_backup.png", "tileset_dino.png"),
        ("tileset_space_backup.png", "tileset_space.png"),
    ]
    
    for backup_name, output_name in tilesets:
        backup_path = assets_dir / backup_name
        output_path = assets_dir / output_name
        
        if backup_path.exists():
            remove_all_grey_background(backup_path, output_path)
        else:
            print(f"Not found: {backup_name}")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
