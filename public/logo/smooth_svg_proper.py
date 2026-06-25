#!/usr/bin/env python3
import xml.etree.ElementTree as ET
import re
import math

def parse_path_data(path_data):
    """Parse SVG path data preserving structure."""
    if not path_data or path_data.strip() == '':
        return []
    
    commands = []
    # Match commands and their parameters
    pattern = r'([MCLZ])\s*([^MCLZ]*)'
    
    for match in re.finditer(pattern, path_data, re.IGNORECASE):
        cmd = match.group(1).upper()
        params_str = match.group(2).strip()
        
        if not params_str:
            commands.append((cmd, []))
            continue
        
        # Extract numbers
        numbers = re.findall(r'-?\d+\.?\d*', params_str)
        coords = [float(n) for n in numbers]
        commands.append((cmd, coords))
    
    return commands

def smooth_bezier_control_points(p0, p1, p2, p3, smoothness=0.3):
    """Smooth Bezier curve control points."""
    # Calculate smoothed control points
    # p0 and p3 are endpoints, p1 and p2 are control points
    
    # Get direction vectors
    dir1 = (p1[0] - p0[0], p1[1] - p0[1])
    dir2 = (p3[0] - p2[0], p3[1] - p2[1])
    
    # Smooth the control points
    new_p1 = (
        p0[0] + dir1[0] * (1 - smoothness),
        p0[1] + dir1[1] * (1 - smoothness)
    )
    new_p2 = (
        p3[0] - dir2[0] * (1 - smoothness),
        p3[1] - dir2[1] * (1 - smoothness)
    )
    
    return new_p1, new_p2

def smooth_path_commands(commands, smooth_factor=0.25):
    """Smooth path commands by adjusting control points."""
    if not commands:
        return commands
    
    smoothed = []
    i = 0
    
    while i < len(commands):
        cmd, coords = commands[i]
        
        if cmd == 'C' and len(coords) >= 6:
            # Cubic Bezier curve
            x1, y1, x2, y2, x3, y3 = coords[0], coords[1], coords[2], coords[3], coords[4], coords[5]
            
            # Get previous point if available
            prev_x, prev_y = 0, 0
            if i > 0 and smoothed:
                last_cmd, last_coords = smoothed[-1]
                if last_cmd == 'M' and len(last_coords) >= 2:
                    prev_x, prev_y = last_coords[0], last_coords[1]
                elif last_cmd == 'C' and len(last_coords) >= 6:
                    prev_x, prev_y = last_coords[4], last_coords[5]
                elif last_cmd == 'L' and len(last_coords) >= 2:
                    prev_x, prev_y = last_coords[0], last_coords[1]
            
            # Smooth the control points
            p0 = (prev_x, prev_y)
            p1 = (x1, y1)
            p2 = (x2, y2)
            p3 = (x3, y3)
            
            # Apply smoothing to control points
            new_p1, new_p2 = smooth_bezier_control_points(p0, p1, p2, p3, smooth_factor)
            
            # Round to 2 decimal places
            smoothed.append(('C', [
                round(new_p1[0], 2), round(new_p1[1], 2),
                round(new_p2[0], 2), round(new_p2[1], 2),
                round(x3, 2), round(y3, 2)
            ]))
        elif cmd == 'M' and len(coords) >= 2:
            smoothed.append(('M', [round(coords[0], 2), round(coords[1], 2)]))
        elif cmd == 'L' and len(coords) >= 2:
            smoothed.append(('L', [round(coords[0], 2), round(coords[1], 2)]))
        elif cmd == 'Z':
            smoothed.append(('Z', []))
        else:
            # Keep other commands as-is
            smoothed.append((cmd, coords))
        
        i += 1
    
    return smoothed

def commands_to_path_data(commands):
    """Convert commands back to path data string."""
    parts = []
    
    for cmd, coords in commands:
        if cmd == 'M':
            parts.append(f"M {coords[0]} {coords[1]}")
        elif cmd == 'C':
            parts.append(f"C {coords[0]}, {coords[1]}, {coords[2]}, {coords[3]}, {coords[4]}, {coords[5]}")
        elif cmd == 'L':
            parts.append(f"L {coords[0]} {coords[1]}")
        elif cmd == 'Z':
            parts.append("Z")
    
    return " ".join(parts)

def smooth_svg(input_file, output_file, smooth_factor=0.25):
    """Smooth all paths in an SVG file."""
    tree = ET.parse(input_file)
    root = tree.getroot()
    
    # Process all path elements
    for path in root.findall('.//{http://www.w3.org/2000/svg}path'):
        path_data = path.get('d', '')
        if not path_data or path_data.strip() == '':
            continue
        
        # Parse and smooth the path
        commands = parse_path_data(path_data)
        if not commands:
            continue
        
        # Smooth the commands
        smoothed_commands = smooth_path_commands(commands, smooth_factor)
        
        # Convert back to path data
        smoothed_path = commands_to_path_data(smoothed_commands)
        if smoothed_path:
            path.set('d', smoothed_path)
    
    # Write the smoothed SVG
    ET.register_namespace('', 'http://www.w3.org/2000/svg')
    tree.write(output_file, encoding='utf-8', xml_declaration=True)

if __name__ == '__main__':
    input_file = '/opt/spyglass/public/logo/logo.svg'
    output_file = '/opt/spyglass/public/logo/logo.svg'
    smooth_factor = 0.2  # Lower = less smoothing, higher = more smoothing
    
    smooth_svg(input_file, output_file, smooth_factor)
    print(f"Smoothed SVG saved to {output_file}")

