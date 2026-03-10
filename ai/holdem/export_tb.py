import os
import argparse
import matplotlib.pyplot as plt
from tensorboard.backend.event_processing.event_accumulator import EventAccumulator
import glob
from pathlib import Path

def export_to_matplotlib(log_dir, output_root=None):
    log_path = Path(log_dir)
    if output_root is None:
        output_root = log_path / 'plots'
    else:
        output_root = Path(output_root)
    
    output_root.mkdir(parents=True, exist_ok=True)

    # Find all event files recursively
    event_files = list(log_path.rglob('events.out.tfevents.*'))
    
    if not event_files:
        print(f"No event files found in {log_dir}")
        return

    print(f"Found {len(event_files)} event files.")

    for event_file in event_files:
        print(f"Processing {event_file}...")
        
        # Determine relative path from log_dir to keep structure
        rel_path = event_file.parent.relative_to(log_path)
        current_output_dir = output_root / rel_path
        current_output_dir.mkdir(parents=True, exist_ok=True)

        try:
            ea = EventAccumulator(str(event_file),
                size_guidance={
                    'scalars': 0, # 0 means load all
                })
            ea.Reload()

            # Check available tags
            tags_dict = ea.Tags()
            if 'scalars' not in tags_dict:
                print(f"No scalars found in {event_file}")
                continue
                
            tags = tags_dict['scalars']
            
            for tag in tags:
                data = ea.Scalars(tag)
                steps = [x.step for x in data]
                values = [x.value for x in data]
                
                plt.figure(figsize=(10, 6))
                plt.plot(steps, values, label=tag)
                plt.title(tag)
                plt.xlabel('Step')
                plt.ylabel('Value')
                plt.legend()
                plt.grid(True)
                
                # Sanitize tag for filename
                safe_tag = tag.replace('/', '_').replace('\\', '_')
                filename = f"{safe_tag}.png"
                save_path = current_output_dir / filename
                
                plt.savefig(save_path)
                plt.close()
                print(f"Saved plot to {save_path}")
        except Exception as e:
            print(f"Failed to process {event_file}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export TensorBoard logs to Matplotlib charts")
    parser.add_argument("--logdir", type=str, required=True, help="Path to TensorBoard log directory")
    parser.add_argument("--output", type=str, help="Output directory for plots")
    
    args = parser.parse_args()
    export_to_matplotlib(args.logdir, args.output)
