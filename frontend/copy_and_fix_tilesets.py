"""
Copy new tilesets to assets folder and process for transparency.
"""
import shutil
from pathlib import Path
from PIL import Image
import numpy as np

# Source directory (generated images)
brain_dir = Path(r"C:\Users\Mischa\.gemini\antigravity\brain\c927443c-d3e4-4c59-b47c-4370ef5a9aa1")
assets_dir = Path(r"C:\Users\Mischa\Aethergrid\frontend\src\assets")

# Mapping of generated files to asset names
tilesets = {
    "fantasy_tileset_new": "tileset_fantasy.png",
    "space_tileset_new": "tileset_space.png",
    "dino_tileset_new": "tileset_dino.png",
    "emberfall_tileset_new": "tileset_emberfall.png",
    "frostbound_tileset_new": "tileset_frostbound.png",
    "oceanic_tileset_new": "tileset_oceanic.png",
}


def remove_grey_background(image_path: Path):
    """Remove grey checkered background pixels."""
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
    
    # Detect grey checkered pixels
    is_grey = (
        (np.abs(r.astype(int) - g.astype(int)) <= 10) & 
        (np.abs(g.astype(int) - b.astype(int)) <= 10)
    )
    is_checker_range = (r >= 140) & (r <= 220)
    is_opaque = (a == 255)
    
    should_make_transparent = is_grey & is_checker_range & is_opaque
    new_alpha = np.where(should_make_transparent, 0, a)
    
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(image_path, format='PNG')
    
    return np.sum(should_make_transparent)


def main():
    # Find and copy/process each tileset
    for prefix, dest_name in tilesets.items():
        # Find the generated file (has timestamp in name)
        matches = list(brain_dir.glob(f"{prefix}_*.png"))
        if matches:
            src = matches[0]
            dest = assets_dir / dest_name
            
            print(f"Copying: {src.name} -> {dest_name}")
            shutil.copy(src, dest)
            
            # Process for transparency
            changed = remove_grey_background(dest)
            print(f"  Removed {changed:,} grey pixels")
        else:
            print(f"Not found: {prefix}_*.png")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
