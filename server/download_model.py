"""Explicit model preparation; never download multi-GB weights during browser startup."""
import argparse
import os
from faster_whisper import WhisperModel

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('model', choices=['turbo', 'large-v3'])
    args = parser.parse_args()
    WhisperModel(args.model, device='cpu', compute_type='int8', cpu_threads=4,
                 download_root=os.environ.get('WHISPER_CACHE_DIR'), local_files_only=False)
    print(f'{args.model} downloaded and loaded successfully. Keep WHISPER_CACHE_DIR the same when starting the service.')
