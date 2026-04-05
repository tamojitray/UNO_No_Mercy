import os

def rename_uno_cards():
    # Path to images folder
    images_path = './'
    
    # Mapping of old names to new convention
    replacements = {
        '2x_': '',           # Remove the 2x_ prefix
        '-1.png': '.png',    # Remove the -1 suffix
        '0_': '',
        '3x_': '',  
        '4x_': '', 
        '8x_': '', 
        'skipall': 'skip_all',
        'draw4': 'draw_four',
        'draw2': 'draw_two',
        'colorroulette': 'color_roulette',
        'reversedraw4': 'reverse_draw_four',
        'draw6': 'draw_six',
        'draw10': 'draw_ten',
        'discardall': 'discard_all'
    }

    try:
        # List all files in the images directory
        files = os.listdir(images_path)
        
        # Filter only png files
        card_files = [f for f in files if f.endswith('.png')]
        
        for old_name in card_files:
            if old_name == '0_back-1.png' or old_name == '0_back.png':
                continue  # Skip the card back image
                
            new_name = old_name.lower()
            
            # Apply all replacements
            for old_text, new_text in replacements.items():
                new_name = new_name.replace(old_text, new_text)
            
            if old_name != new_name:
                old_path = os.path.join(images_path, old_name)
                new_path = os.path.join(images_path, new_name)
                
                try:
                    os.rename(old_path, new_path)
                    print(f'Renamed: {old_name} → {new_name}')
                except OSError as e:
                    print(f'Error renaming {old_name}: {e}')

    except Exception as e:
        print(f'An error occurred: {e}')

if __name__ == '__main__':
    rename_uno_cards()