"""Tiny-only full-run entry point; shared gated, offline, sequential worker."""
import argparse
from asr_pilot_worker import run
from pilot_common import ROOT,read

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--job',required=True)
    args=parser.parse_args()
    if read(args.job).get('mode')!='full':raise ValueError('Full job required')
    raise SystemExit(run(args.job,ROOT/'evaluation/results/raw/asr_full_tiny'))
