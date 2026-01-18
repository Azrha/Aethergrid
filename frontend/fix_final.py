"""
FINAL FIX: Make ALL grey checkered pixels transparent.
These pixels are OPAQUE and drawing over our solid diamond underlays.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import shutil


def make_grey_transparent(image_path: Path, output_path: Path):
    """Convert all grey checkered pixels to transparent."""
    print(f"Processing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
    
    # Detect grey pixels (R ≈ G ≈ B with tolerance)
    is_grey = (
        (np.abs(r.astype(int) - g.astype(int)) <= 10) & 
        (np.abs(g.astype(int) - b.astype(int)) <= 10)
    )
    
    # Target the checkered range: 140-220 (covers light and dark checker)
    is_checker_range = (r >= 140) & (r <= 220)
    
    # Must currently be opaque
    is_opaque = (a == 255)
    
    # Combine all conditions
    should_make_transparent = is_grey & is_checker_range & is_opaque
    
    # Set alpha to 0 for matching pixels
    new_alpha = np.where(should_make_transparent, 0, a)
    
    # Create output
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(output_path, format='PNG')
    
    changed = np.sum(should_make_transparent)
    print(f"  Made {changed} opaque grey pixels transparent")
    return changed


def main():
    assets_dir = Path(__file__).parent / "src" / "assets"
    
    # Process all tilesets from backups
    tilesets = [
        ("tileset_backup.png", "tileset.png"),
        ("tileset_fantasy_backup.png", "tileset_fantasy.png"),
        ("tileset_oceanic_backup.png", "tileset_oceanic.png"),
        ("tileset_frostbound_backup.png", "tileset_frostbound.png"),
        ("tileset_emberfall_backup.png", "tileset_emberfall.png"),
        ("tileset_dino_backup.png", "tileset_dino.png"),
        ("tileset_space_backup.png", "tileset_space.png"),
    ]
    
    total = 0
    for backup_name, output_name in tilesets:
        backup_path = assets_dir / backup_name
        output_path = assets_dir / output_name
        
        if backup_path.exists():
            total += make_grey_transparent(backup_path, output_path)
        else:
            print(f"Backup not found: {backup_name}")
    
    print(f"\nTotal pixels made transparent: {total:,}")
    print("Done!")


if __name__ == "__main__":
    main()
