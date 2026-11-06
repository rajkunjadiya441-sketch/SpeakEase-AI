"""Strict base.en pilot entry point; shared gated/offline inference worker."""
import argparse
from asr_pilot_worker import run
from pilot_common import BASE_RAW,read

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--job',required=True)
    args=parser.parse_args();job=read(args.job)
    if job.get('mode')!='pilot' or job.get('settings',{}).get('model')!='base.en':
        raise ValueError('Only a base.en pilot is approved')
    return run(args.job,BASE_RAW)
if __name__=='__main__':raise SystemExit(main())
