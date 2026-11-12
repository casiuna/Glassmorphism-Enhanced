"""Compatibility entry point for the current stable delivery verifier.

Historical trial verification was tied to a retired Hermes session and 0.1
artifacts. Stable verification must use current archives and actual QA reports.
"""
import runpy
import sys
from pathlib import Path

if __name__ == '__main__':
    directory = Path(__file__).resolve().parents[1] / 'full'
    sys.path.insert(0, str(directory))
    runpy.run_path(str(directory / 'verify_delivery.py'), run_name='__main__')
