"""
Copy new tilesets (Neon, Skyborne, Ironwild) to assets and process.
Also remove black outlines from ALL tilesets.
"""
import shutil
from pathlib import Path
from PIL import Image
import numpy as np

# Source directory
brain_dir = Path(r"C:\Users\Mischa\.gemini\antigravity\brain\c927443c-d3e4-4c59-b47c-4370ef5a9aa1")
assets_dir = Path(r"C:\Users\Mischa\Aethergrid\frontend\src\assets")

# New tilesets
new_tilesets = {
    "neon_tileset_new": "tileset_neon.png",
    "skyborne_tileset_new": "tileset_skyborne.png",
    "ironwild_tileset_new": "tileset_ironwild.png",
}


def remove_grey_and_black(image_path: Path):
    """Remove grey checkered background and black outline pixels."""
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
    
    # Remove grey checkered background
    is_grey = (
        (np.abs(r.astype(int) - g.astype(int)) <= 10) & 
        (np.abs(g.astype(int) - b.astype(int)) <= 10)
    )
    is_checker_range = (r >= 140) & (r <= 220)
    
    # Remove very dark/black pixels (likely outlines)
    is_black = (r <= 35) & (g <= 35) & (b <= 35)
    
    should_make_transparent = (is_grey & is_checker_range) | is_black
    is_opaque = (a == 255)
    
    new_alpha = np.where(should_make_transparent & is_opaque, 0, a)
    
    output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
    output_img = Image.fromarray(output, 'RGBA')
    output_img.save(image_path, format='PNG')
    
    grey_removed = np.sum((is_grey & is_checker_range) & is_opaque)
    black_removed = np.sum(is_black & is_opaque)
    return grey_removed, black_removed


def main():
    # Copy and process new tilesets
    print("=== Processing NEW tilesets ===")
    for prefix, dest_name in new_tilesets.items():
        matches = list(brain_dir.glob(f"{prefix}_*.png"))
        if matches:
            src = matches[0]
            dest = assets_dir / dest_name
            
            print(f"Copying: {src.name} -> {dest_name}")
            shutil.copy(src, dest)
            
            grey, black = remove_grey_and_black(dest)
            print(f"  Removed {grey:,} grey, {black:,} black pixels")
        else:
            print(f"Not found: {prefix}_*.png")
    
    # Also remove black outlines from existing tilesets
    print("\n=== Removing black outlines from existing tilesets ===")
    existing = [
        "tileset.png", "tileset_fantasy.png", "tileset_space.png",
        "tileset_dino.png", "tileset_emberfall.png", 
        "tileset_frostbound.png", "tileset_oceanic.png"
    ]
    for name in existing:
        path = assets_dir / name
        if path.exists():
            img = Image.open(path).convert('RGBA')
            pixels = np.array(img)
            r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
            
            is_black = (r <= 35) & (g <= 35) & (b <= 35) & (a == 255)
            new_alpha = np.where(is_black, 0, a)
            
            output = np.stack([r, g, b, new_alpha], axis=-1).astype(np.uint8)
            Image.fromarray(output, 'RGBA').save(path, format='PNG')
            
            print(f"{name}: removed {np.sum(is_black):,} black pixels")
    
    print("\nDone!")


if __name__ == "__main__":
    main()
