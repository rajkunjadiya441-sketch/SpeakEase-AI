"""Dedicated full base.en entry, sharing the existing sequential/offline worker."""
import argparse
from asr_pilot_worker import run
from pilot_common import ROOT,read

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--job',required=True);args=parser.parse_args()
    job=read(args.job)
    if job.get('mode')!='full' or job.get('settings',{}).get('model')!='base.en':raise ValueError('Full base.en job required')
    return run(args.job,ROOT/'evaluation/results/raw/asr_full_base_en')
if __name__=='__main__':raise SystemExit(main())
