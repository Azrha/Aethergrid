"""
Analyze tileset to check if checkered pixels have alpha or not.
"""
from pathlib import Path
from PIL import Image
import numpy as np

def analyze_tileset(image_path: Path):
    """Check if checkered pixels are transparent or opaque."""
    print(f"\nAnalyzing: {image_path.name}")
    
    img = Image.open(image_path).convert('RGBA')
    pixels = np.array(img)
    
    r, g, b, a = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2], pixels[:,:,3]
    
    # Find all grey pixels
    is_exact_grey = (np.abs(r.astype(int) - g.astype(int)) <= 5) & (np.abs(g.astype(int) - b.astype(int)) <= 5)
    is_grey_range = (r >= 140) & (r <= 220)
    is_grey = is_exact_grey & is_grey_range
    
    grey_alphas = a[is_grey]
    
    print(f"  Total pixels: {pixels.shape[0] * pixels.shape[1]}")
    print(f"  Grey pixels: {np.sum(is_grey)}")
    print(f"  Grey pixels with alpha=255 (opaque): {np.sum(grey_alphas == 255)}")
    print(f"  Grey pixels with alpha=0 (transparent): {np.sum(grey_alphas == 0)}")
    print(f"  Grey pixels with alpha 1-254: {np.sum((grey_alphas > 0) & (grey_alphas < 255))}")
    
    # Sample some grey pixel values
    grey_coords = np.where(is_grey)
    if len(grey_coords[0]) > 0:
        print(f"\n  Sample grey pixels (y, x, r, g, b, a):")
        for i in range(min(5, len(grey_coords[0]))):
            y, x = grey_coords[0][i], grey_coords[1][i]
            print(f"    ({y}, {x}): ({r[y,x]}, {g[y,x]}, {b[y,x]}, {a[y,x]})")


def main():
    assets_dir = Path(__file__).parent / "src" / "assets"
    
    for name in ["tileset.png", "tileset_fantasy.png", "tileset_dino.png"]:
        path = assets_dir / name
        if path.exists():
            analyze_tileset(path)


if __name__ == "__main__":
    main()
