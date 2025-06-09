import os
import sys
import time
import subprocess

def run_command(command, description):
    """Run a command and print its output in real-time."""
    print(f"\n{'='*80}")
    print(f"STARTING: {description}")
    print(f"{'='*80}\n")
    
    process = subprocess.Popen(
        command, 
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        shell=True
    )
    
    # Print output in real-time
    for line in process.stdout:
        print(line, end='')
    
    # Wait for process to complete
    process.wait()
    
    if process.returncode != 0:
        print(f"\nERROR: {description} failed with return code {process.returncode}")
    else:
        print(f"\nSUCCESS: {description} completed successfully")
    
    return process.returncode

def main():
    """Main function to run all model training and fine-tuning steps."""
    start_time = time.time()
    
    # Step 1: Train models for missing stocks
    run_command("python train_missing_models.py", "Training models for missing stocks")
    
    # Step 2: Fine-tune all models (including newly created ones)
    run_command("python finetune_models.py", "Fine-tuning all stock models")
    
    # Print summary
    elapsed_time = time.time() - start_time
    hours, rem = divmod(elapsed_time, 3600)
    minutes, seconds = divmod(rem, 60)
    
    print(f"\n{'='*80}")
    print("MODEL UPDATE COMPLETE")
    print(f"Total time: {int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}")
    print(f"{'='*80}")

if __name__ == "__main__":
    main()