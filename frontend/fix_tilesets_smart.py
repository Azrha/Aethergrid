"""
Restore tilesets from backups and apply SMART fix:
Only remove exact checkered pattern colors (192,192,192 and 153,153,153 alternating pattern)
Uses pattern detection instead of just color detection.
"""
import shutil
from pathlib import Path

from PIL import Image
import numpy as np


def is_checkered_pixel(pixels: np.ndarray, y: int, x: int, height: int, width: int) -> bool:
    """Check if this pixel is part of a checkered pattern by looking at neighbors."""
    r, g, b = pixels[y, x, 0], pixels[y, x, 1], pixels[y, x, 2]
    
    # Only check grey pixels (R ≈ G ≈ B)
    if abs(int(r) - int(g)) > 5 or abs(int(g) - int(b)) > 5:
        return False
    
    # Must be in typical checker range
    if not (150 <= r <= 210):
        return False
    
    # Check if neighbors have alternating grey pattern
    neighbor_count = 0
    diff_count = 0
    
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        ny, nx = y + dy, x + dx
        if 0 <= ny < height and 0 <= nx < width:
            nr, ng, nb = pixels[ny, nx, 0], pixels[ny, nx, 1], pixels[ny, nx, 2]
            # Is neighbor also grey?
            if abs(int(nr) - int(ng)) <= 5 and abs(int(ng) - int(nb)) <= 5:
                if 150 <= nr <= 210:
                    neighbor_count += 1
                    # Check if it's a different grey shade (alternating)
                    if abs(int(r) - int(nr)) > 30:
                        diff_count += 1
    
    # If most neighbors are alternating grey, it's checkered
    return neighbor_count >= 2 and diff_count >= 2


def smart_fix_tileset(image_path: Path, output_path: Path):
    """Smart checkered pattern removal using neighbor analysis."""
    print(f"Processing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    height, width = pixels.shape[:2]
    
    # Create alpha mask
    new_alpha = pixels[:, :, 3].copy()
    changed = 0
    
    # Check each pixel
    for y in range(height):
        for x in range(width):
            if new_alpha[y, x] > 0 and is_checkered_pixel(pixels, y, x, height, width):
                new_alpha[y, x] = 0
                changed += 1
    
    # Create output
    output = np.stack([pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(output_path, format='PNG')
    
    print(f"  Made {changed} pixels transparent")


def simple_grey_removal(image_path: Path, output_path: Path):
    """Simple but careful grey removal - only exact checkered colors."""
    print(f"Processing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
    
    # Very specific: exact grey (R=G=B) with values typical of checkerboard
    is_exact_grey = (r == g) & (g == b)
    
    # Typical checkerboard greys: 153, 192, 204
    is_checker_153 = (r >= 150) & (r <= 156)
    is_checker_192 = (r >= 189) & (r <= 195)
    is_checker_204 = (r >= 201) & (r <= 207)
    is_checker_color = is_checker_153 | is_checker_192 | is_checker_204
    
    # Combine
    is_checkered = is_exact_grey & is_checker_color
    
    new_alpha = np.where(is_checkered, 0, a)
    
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(output_path, format='PNG')
    
    orig_opaque = np.sum(a > 0)
    new_opaque = np.sum(new_alpha > 0)
    print(f"  Made {orig_opaque - new_opaque} pixels transparent")


def main():
    assets_dir = Path(__file__).parent / "src" / "assets"
    
    # All tilesets to process from backups
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
            simple_grey_removal(backup_path, output_path)
        else:
            print(f"Backup not found: {backup_name}")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
