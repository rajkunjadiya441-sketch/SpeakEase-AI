"""Audit/export reviewed files only. Never changes project Git metadata or commits/pushes."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[1]
LOCAL=ROOT/'.publication'
MANIFEST=ROOT/'docs/PUBLICATION_FILES.txt'
PRUNE={'.git','.venv','venv','node_modules','__pycache__','.cache','qa','dist','dist-ssr','build','.publication'}
RULES={
 'private_key':re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
 'provider_key':re.compile(r'(?:github_pat_[A-Za-z0-9_]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|hf_[A-Za-z0-9]{25,}|sk-(?:proj-)?[A-Za-z0-9_-]{25,}|AKIA[A-Z0-9]{16})'),
 'credential_url':re.compile(r'https?://[^\s/:]+:[^\s/@]{4,}@'),
}
TEXT={'.py','.ps1','.js','.jsx','.mjs','.json','.jsonl','.md','.txt','.html','.css','.svg','.example','.yml','.yaml','.toml'}

def git(args,allowed=(0,),**kwargs):
    result=subprocess.run(['git',*args],capture_output=True,check=False,**kwargs)
    if result.returncode not in allowed:raise RuntimeError('Git command failed: '+result.stderr.decode(errors='replace'))
    return result

def inventory():
    files=[]
    for parent,dirs,names in os.walk(ROOT,followlinks=False):
        dirs[:]=sorted(d for d in dirs if d not in PRUNE)
        for name in sorted(names):
            path=Path(parent)/name
            if path.is_symlink() or not path.resolve().is_relative_to(ROOT):raise RuntimeError('Review linked file before publication: '+str(path))
            files.append(path.relative_to(ROOT).as_posix())
    return sorted(files)

def select(files,gitdir):
    raw='\0'.join(files).encode()+b'\0'
    result=git(['-c','core.excludesFile='+str(LOCAL/'empty-global-ignore'),'--git-dir='+str(gitdir),'--work-tree='+str(ROOT),'check-ignore','--no-index','--stdin','-z'],allowed=(0,1),input=raw)
    ignored=set(result.stdout.decode().split('\0'))
    return [f for f in files if f not in ignored]

def audit(files):
    findings=[];absolute=[];sizes=[]
    for name in files:
        path=ROOT/name;size=path.stat().st_size;sizes.append((size,name))
        if size>5*1024**2:findings.append({'file':name,'rule':'published_file_over_5MiB'})
        if path.suffix.lower() not in TEXT and path.name not in ('.gitignore','.env.example','.oxlintrc.json'):continue
        try:content=path.read_text(encoding='utf-8-sig')
        except UnicodeError:continue
        for line_number,line in enumerate(content.splitlines(),1):
            for rule,pattern in RULES.items():
                if pattern.search(line):findings.append({'file':name,'line':line_number,'rule':rule})
            if path.suffix=='.md' and re.search(r'[A-Za-z]:[\\/]Users[\\/]',line):absolute.append({'file':name,'line':line_number})
    return {'files':len(files),'total_bytes':sum(s for s,_ in sizes),'largest_files':[{'file':n,'bytes':s} for s,n in sorted(sizes,reverse=True)[:10]],
        'high_confidence_secret_or_size_findings':findings,'historical_absolute_path_locations':absolute,
        'security_limitations':'Pattern scan is not proof of absence. Demo patient data are source fixtures; browser profiles and private recordings excluded. Review licensing separately.'}

def prepare(export=False):
    LOCAL.mkdir(exist_ok=True);(LOCAL/'empty-global-ignore').touch();MANIFEST.parent.mkdir(exist_ok=True);MANIFEST.touch(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='speakease-index-preview-') as temp:
        preview=Path(temp);git(['init','-q',str(preview)])
        files=select(inventory(),preview/'.git');MANIFEST.write_text('\n'.join(files)+'\n',encoding='utf-8')
        report=audit(files)
        required=['backend/app/main.py','alignment/align_recording.py','backend/requirements.txt','backend/requirements-lock.txt','alignment/requirements.txt','alignment/requirements-lock.txt','backend/.env.example','ipd_frontend/.env.example','ipd_frontend/package.json','ipd_frontend/package-lock.json','ipd_frontend/src/main.jsx','ipd_frontend/index.html','README.md']
        if any(name not in files for name in required):raise RuntimeError('Required source/config missing from publication')
        if report['high_confidence_secret_or_size_findings']:raise RuntimeError('Review findings before export: '+json.dumps(report['high_confidence_secret_or_size_findings']))
        target=LOCAL/'checkout'
        if export:
            if target.exists():raise RuntimeError('Existing publication checkout retained; use a new reviewed export rather than overwriting it')
            target.mkdir()
            for name in files:
                destination=target/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,destination)
            if list(target.rglob('.git')) or (target/'.gitmodules').exists():raise RuntimeError('Unexpected nested Git metadata in export')
            # Stage only in a DISPOSABLE index; the export itself remains without .git.
            paths=b'\0'.join(name.encode() for name in files)+b'\0'
            git(['--git-dir='+str(preview/'.git'),'--work-tree='+str(target),'-c','core.autocrlf=false','add','--pathspec-from-file=-','--pathspec-file-nul'],input=paths)
            entries=git(['--git-dir='+str(preview/'.git'),'--work-tree='+str(target),'ls-files','--stage','-z']).stdout.decode().split('\0')
            entries=[line for line in entries if line]
            if len(entries)!=len(files) or any(not line.startswith('100644 ') for line in entries):raise RuntimeError('Preview index contains missing files or non-ordinary file modes')
            report.update(export_verified=True,ordinary_index_files=len(entries),gitlinks=0,export_path=str(target),export_sha256={name:hashlib.sha256((target/name).read_bytes()).hexdigest() for name in files})
        report.update(project_git_initialized=False,committed=False,pushed=False,nested_git_modified=False)
        (LOCAL/'audit.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({k:v for k,v in report.items() if k not in ('export_sha256','historical_absolute_path_locations')},indent=2))
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--export',action='store_true');args=parser.parse_args();prepare(args.export)
