"""
Generate aviation-style gauge images for the coaching app
"""
from PIL import Image, ImageDraw, ImageFont
import math

def create_gauge(filename, gauge_type='standard', title='', subtitle=''):
    """
    Create a gauge image
    gauge_type: 'standard' (240° arc), 'fuel' (180° bottom half), 'compass' (360° full circle)
    """
    # Image settings
    size = 400
    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    center = size // 2
    outer_radius = 180
    inner_radius = 140

    # Background circle - dark metallic look
    draw.ellipse([20, 20, size-20, size-20], fill='#1a1a2e', outline='#0f3460', width=3)

    # Inner gauge face - lighter background
    draw.ellipse([60, 60, size-60, size-60], fill='#16213e', outline='#0f3460', width=2)

    # Draw tick marks and numbers
    if gauge_type == 'fuel':
        # Bottom semicircle (180°)
        start_angle = 180
        end_angle = 360
        angles = range(start_angle, end_angle + 1, 30)
        labels = ['E', '', '', '', '', '', 'F']
    elif gauge_type == 'compass':
        # Full circle (360°)
        start_angle = 0
        end_angle = 360
        angles = range(0, 360, 30)
        labels = ['N', '', '', 'E', '', '', 'S', '', '', 'W', '', '']
    else:
        # Standard 240° arc
        start_angle = -120
        end_angle = 120
        angles = range(start_angle, end_angle + 1, 30)
        labels = ['0', '', '', '', '50', '', '', '', '100']

    # Draw tick marks
    for i, angle in enumerate(angles):
        angle_rad = math.radians(angle)

        # Major tick
        x1 = center + (outer_radius - 25) * math.cos(angle_rad)
        y1 = center + (outer_radius - 25) * math.sin(angle_rad)
        x2 = center + (outer_radius - 10) * math.cos(angle_rad)
        y2 = center + (outer_radius - 10) * math.sin(angle_rad)
        draw.line([x1, y1, x2, y2], fill='#e94560', width=3)

        # Draw labels
        if i < len(labels) and labels[i]:
            label_x = center + (outer_radius - 45) * math.cos(angle_rad)
            label_y = center + (outer_radius - 45) * math.sin(angle_rad)
            # Simple text without font
            bbox = draw.textbbox((label_x, label_y), labels[i], anchor='mm')
            draw.text((label_x, label_y), labels[i], fill='#ffffff', anchor='mm')

    # Draw minor tick marks
    minor_angles = []
    if gauge_type == 'fuel':
        minor_angles = range(180, 361, 10)
    elif gauge_type == 'compass':
        minor_angles = range(0, 360, 10)
    else:
        minor_angles = range(-120, 121, 10)

    for angle in minor_angles:
        if angle not in angles:  # Skip major ticks
            angle_rad = math.radians(angle)
            x1 = center + (outer_radius - 20) * math.cos(angle_rad)
            y1 = center + (outer_radius - 20) * math.sin(angle_rad)
            x2 = center + (outer_radius - 10) * math.cos(angle_rad)
            y2 = center + (outer_radius - 10) * math.sin(angle_rad)
            draw.line([x1, y1, x2, y2], fill='#533483', width=2)

    # Center hub
    draw.ellipse([center-15, center-15, center+15, center+15], fill='#2d2d44', outline='#e94560', width=2)

    # Title text
    if title:
        draw.text((center, 80), title, fill='#ffffff', anchor='mm')
    if subtitle:
        draw.text((center, 320), subtitle, fill='#aaaaaa', anchor='mm')

    # Save image
    img.save(filename, 'PNG')
    print(f"Created {filename}")

# Create all gauge images
print("Generating gauge images...")

# Standard gauges will be custom with white background and color zones
# (Engine, Positive, Weight, Negative)

# Thrust gauge (240° arc rotated 90° CCW) - WHITE BACKGROUND with COLOR ZONES
img = Image.new('RGBA', (400, 400), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)
center = 200
outer_radius = 180

# White background circle
draw.ellipse([20, 20, 380, 380], fill='#ffffff', outline='#cccccc', width=3)

# Draw colored arc zones BEFORE the inner circle (rotated 90° counter-clockwise from standard gauge)
# Standard gauge goes from -120° to +120° (240° arc)
# After 90° CCW rotation: -120° becomes -210° (= 150°), +120° becomes 30°
# So the arc now spans from 150° to 30° (going clockwise through top)

# Red zone: 0-33% (150° to 230°)
draw.pieslice([60, 60, 340, 340], start=150, end=230, fill='#fca5a5', outline='#dc2626', width=2)

# Yellow zone: 34-66% (230° to 310°)
draw.pieslice([60, 60, 340, 340], start=230, end=310, fill='#fde68a', outline='#fbbf24', width=2)

# Green zone: 67-100% (310° to 30°, wrapping through 0°)
draw.pieslice([60, 60, 340, 340], start=310, end=390, fill='#bbf7d0', outline='#22c55e', width=2)

# Inner gauge face - white (covers the center, leaving colored ring visible)
draw.ellipse([100, 100, 300, 300], fill='#ffffff', outline='#cccccc', width=2)

# Draw tick marks for thrust gauge (rotated 90° CCW + 180° = 270° total = -90°)
# Original: -120° to +120°
# After 90° CCW rotation: add 90°
# After additional 180° rotation: add another 180° (total: +270° or -90°)
angles_original = range(-120, 121, 30)
labels = ['0', '', '', '', '50', '', '', '', '100']

# Draw major tick marks
for i, angle_orig in enumerate(angles_original):
    angle = angle_orig + 90 + 180  # Rotate 90° CCW then 180° more
    angle_rad = math.radians(angle)

    # Major tick
    x1 = center + (outer_radius - 25) * math.cos(angle_rad)
    y1 = center + (outer_radius - 25) * math.sin(angle_rad)
    x2 = center + (outer_radius - 10) * math.cos(angle_rad)
    y2 = center + (outer_radius - 10) * math.sin(angle_rad)
    draw.line([x1, y1, x2, y2], fill='#000000', width=3)

    # Draw labels
    if i < len(labels) and labels[i]:
        label_x = center + (outer_radius - 45) * math.cos(angle_rad)
        label_y = center + (outer_radius - 45) * math.sin(angle_rad)
        draw.text((label_x, label_y), labels[i], fill='#000000', anchor='mm')

# Draw minor tick marks (rotated 90° CCW + 180°)
minor_angles_original = range(-120, 121, 10)
for angle_orig in minor_angles_original:
    angle = angle_orig + 90 + 180  # Rotate 90° CCW then 180° more
    if angle_orig not in angles_original:  # Skip major ticks
        angle_rad = math.radians(angle)
        x1 = center + (outer_radius - 20) * math.cos(angle_rad)
        y1 = center + (outer_radius - 20) * math.sin(angle_rad)
        x2 = center + (outer_radius - 10) * math.cos(angle_rad)
        y2 = center + (outer_radius - 10) * math.sin(angle_rad)
        draw.line([x1, y1, x2, y2], fill='#666666', width=2)

# Title text
draw.text((center, 70), 'THRUST', fill='#000000', anchor='mm')
draw.text((center, 330), 'Power', fill='#666666', anchor='mm')

# Center hub
draw.ellipse([center-15, center-15, center+15, center+15], fill='#cccccc', outline='#000000', width=2)

img.save('images/thrust-gauge.png', 'PNG')
print("Created images/thrust-gauge.png (white background with color zones, rotated 90° CCW)")

# Helper function to create standard gauge with color zones
def create_standard_color_gauge(filename, title, subtitle):
    img = Image.new('RGBA', (400, 400), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)
    center = 200
    outer_radius = 180

    # White background circle
    draw.ellipse([20, 20, 380, 380], fill='#ffffff', outline='#cccccc', width=3)

    # Draw colored arc zones (rotated 90° CCW + 180°)
    # Red zone: 0-33%
    draw.pieslice([60, 60, 340, 340], start=150, end=230, fill='#fca5a5', outline='#dc2626', width=2)
    # Yellow zone: 34-66%
    draw.pieslice([60, 60, 340, 340], start=230, end=310, fill='#fde68a', outline='#fbbf24', width=2)
    # Green zone: 67-100%
    draw.pieslice([60, 60, 340, 340], start=310, end=390, fill='#bbf7d0', outline='#22c55e', width=2)

    # Inner gauge face - white
    draw.ellipse([100, 100, 300, 300], fill='#ffffff', outline='#cccccc', width=2)

    # Draw tick marks (rotated 90° CCW + 180°)
    angles_original = range(-120, 121, 30)
    labels = ['0', '', '', '', '50', '', '', '', '100']

    # Major tick marks
    for i, angle_orig in enumerate(angles_original):
        angle = angle_orig + 90 + 180
        angle_rad = math.radians(angle)

        x1 = center + (outer_radius - 25) * math.cos(angle_rad)
        y1 = center + (outer_radius - 25) * math.sin(angle_rad)
        x2 = center + (outer_radius - 10) * math.cos(angle_rad)
        y2 = center + (outer_radius - 10) * math.sin(angle_rad)
        draw.line([x1, y1, x2, y2], fill='#000000', width=3)

        if i < len(labels) and labels[i]:
            label_x = center + (outer_radius - 45) * math.cos(angle_rad)
            label_y = center + (outer_radius - 45) * math.sin(angle_rad)
            draw.text((label_x, label_y), labels[i], fill='#000000', anchor='mm')

    # Minor tick marks
    minor_angles_original = range(-120, 121, 10)
    for angle_orig in minor_angles_original:
        angle = angle_orig + 90 + 180
        if angle_orig not in angles_original:
            angle_rad = math.radians(angle)
            x1 = center + (outer_radius - 20) * math.cos(angle_rad)
            y1 = center + (outer_radius - 20) * math.sin(angle_rad)
            x2 = center + (outer_radius - 10) * math.cos(angle_rad)
            y2 = center + (outer_radius - 10) * math.sin(angle_rad)
            draw.line([x1, y1, x2, y2], fill='#666666', width=2)

    # Title text
    draw.text((center, 70), title, fill='#000000', anchor='mm')
    draw.text((center, 330), subtitle, fill='#666666', anchor='mm')

    # Center hub
    draw.ellipse([center-15, center-15, center+15, center+15], fill='#cccccc', outline='#000000', width=2)

    img.save(filename, 'PNG')
    print(f"Created {filename} (white background with color zones)")

# Create the four standard gauges with color zones
create_standard_color_gauge('images/engine-gauge.png', 'ENGINE', 'Condition')
create_standard_color_gauge('images/positive-gauge.png', 'POSITIVE', 'Emotion')
create_standard_color_gauge('images/weight-gauge.png', 'WEIGHT', 'Balance')
create_standard_color_gauge('images/negative-gauge.png', 'NEGATIVE', 'Stress')

# Fuel gauge (180° semicircle) - WHITE BACKGROUND with BLACK FUEL ICON
img = Image.new('RGBA', (400, 400), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)
center = 200
outer_radius = 180

# White background circle
draw.ellipse([20, 20, 380, 380], fill='#ffffff', outline='#cccccc', width=3)

# Draw colored arc zones BEFORE the inner circle (rotated 90° counter-clockwise)
# Green zone: 67-100% (270° to 330°) - Full at left
draw.pieslice([60, 60, 340, 340], start=270, end=330, fill='#bbf7d0', outline='#22c55e', width=2)

# Yellow zone: 34-66% (330° to 390° = 330° to 30°) - Middle
draw.pieslice([60, 60, 340, 340], start=330, end=30, fill='#fde68a', outline='#fbbf24', width=2)

# Red zone: 0-33% (30° to 90°) - Empty at right
draw.pieslice([60, 60, 340, 340], start=30, end=90, fill='#fca5a5', outline='#dc2626', width=2)

# Inner gauge face - white (covers the center, leaving colored ring visible)
draw.ellipse([100, 100, 300, 300], fill='#ffffff', outline='#cccccc', width=2)

# Draw tick marks for fuel gauge (270° to 90° = -90° to 90°)
start_angle = 270  # Left side
end_angle = 90     # Right side (goes through top: 270->360->0->90)
angles = [270, 300, 330, 0, 30, 60, 90]
labels = ['F', '', '', '', '', '', 'E']

# Draw major tick marks
for i, angle in enumerate(angles):
    angle_rad = math.radians(angle)

    # Major tick
    x1 = center + (outer_radius - 25) * math.cos(angle_rad)
    y1 = center + (outer_radius - 25) * math.sin(angle_rad)
    x2 = center + (outer_radius - 10) * math.cos(angle_rad)
    y2 = center + (outer_radius - 10) * math.sin(angle_rad)
    draw.line([x1, y1, x2, y2], fill='#000000', width=3)

    # Draw labels
    if i < len(labels) and labels[i]:
        label_x = center + (outer_radius - 45) * math.cos(angle_rad)
        label_y = center + (outer_radius - 45) * math.sin(angle_rad)
        draw.text((label_x, label_y), labels[i], fill='#000000', anchor='mm')

# Draw minor tick marks (270° to 90°, wrapping around)
minor_angles = list(range(270, 360, 10)) + list(range(0, 91, 10))
for angle in minor_angles:
    if angle not in angles:  # Skip major ticks
        angle_rad = math.radians(angle)
        x1 = center + (outer_radius - 20) * math.cos(angle_rad)
        y1 = center + (outer_radius - 20) * math.sin(angle_rad)
        x2 = center + (outer_radius - 10) * math.cos(angle_rad)
        y2 = center + (outer_radius - 10) * math.sin(angle_rad)
        draw.line([x1, y1, x2, y2], fill='#666666', width=2)

# Draw fuel pump icon on the left side (will be colored dynamically in JavaScript)
# Position: left of center
pump_x = center - 60  # Move left
pump_y = center - 10   # Move up slightly

# Note: Icon will be black by default, JavaScript will change color based on fuel level
# Fuel pump body (rectangle)
draw.rectangle([pump_x-20, pump_y-25, pump_x+20, pump_y+25], fill='#666666', outline='#333333')

# Fuel pump nozzle/hose
draw.rectangle([pump_x-25, pump_y-15, pump_x-20, pump_y-5], fill='#666666', outline='#333333')

# Fuel pump display screen (white rectangle on pump)
draw.rectangle([pump_x-12, pump_y-15, pump_x+12, pump_y-5], fill='#ffffff', outline='#333333', width=1)

# Fuel droplet icon
droplet_top_x = pump_x
droplet_top_y = pump_y + 5
draw.ellipse([droplet_top_x-6, droplet_top_y, droplet_top_x+6, droplet_top_y+12], fill='#666666')
draw.polygon([(droplet_top_x, droplet_top_y-8), (droplet_top_x-6, droplet_top_y), (droplet_top_x+6, droplet_top_y)], fill='#666666')

# Title text
draw.text((center, 70), 'FUEL', fill='#000000', anchor='mm')
draw.text((center, 330), 'Energy Level', fill='#666666', anchor='mm')

# Center hub (will be covered by needle center)
draw.ellipse([center-15, center-15, center+15, center+15], fill='#cccccc', outline='#000000', width=2)

img.save('images/fuel-gauge.png', 'PNG')
print("Created images/fuel-gauge.png (white background with black fuel icon)")

# Compass gauges (360° full circle)
create_gauge('images/compass-gauge.png', 'compass', 'COMPASS', 'Direction')

# Horizon gauge (special - shows level)
img = Image.new('RGBA', (400, 400), (255, 255, 255, 0))
draw = ImageDraw.Draw(img)
center = 200

# Background
draw.ellipse([20, 20, 380, 380], fill='#1a1a2e', outline='#0f3460', width=3)

# Sky (blue top half)
draw.pieslice([60, 60, 340, 340], start=180, end=360, fill='#0066cc', outline='#0f3460')

# Ground (brown bottom half)
draw.pieslice([60, 60, 340, 340], start=0, end=180, fill='#8b4513', outline='#0f3460')

# Horizon line
draw.line([60, center, 340, center], fill='#ffffff', width=3)

# Center aircraft symbol
draw.line([center-40, center, center-20, center], fill='#ffff00', width=4)
draw.line([center+20, center, center+40, center], fill='#ffff00', width=4)
draw.ellipse([center-8, center-8, center+8, center+8], fill='#ffff00', outline='#ff8800', width=2)

# Tick marks
for i in range(-30, 31, 10):
    y = center + i * 2
    if i != 0:
        draw.line([80, y, 100, y], fill='#ffffff', width=2)
        draw.line([300, y, 320, y], fill='#ffffff', width=2)

# Title
draw.text((center, 80), 'HORIZON', fill='#ffffff', anchor='mm')
draw.text((center, 320), 'Attitude', fill='#aaaaaa', anchor='mm')

img.save('images/horizon-gauge.png', 'PNG')
print("Created images/horizon-gauge.png")

print("\nAll gauge images generated successfully!")
print("Images are saved in the 'images' folder")
