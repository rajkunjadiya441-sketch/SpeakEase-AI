"""Dependency-free Levenshtein scoring; normalization v1, not JiWER."""
import unicodedata

POLICY = 'stdlib-levenshtein-v1; ties: equal, substitution, deletion, insertion'

def normalize(text):
    text=unicodedata.normalize('NFKC',text).lower()
    text=text.translate(str.maketrans({'’':"'",'‘':"'",'ʼ':"'"}))
    text=''.join(' ' if unicodedata.category(c)=='Pd' else c for c in text)
    text=''.join(c for i,c in enumerate(text) if not unicodedata.category(c).startswith('P') or
                 (c=="'" and i>0 and i+1<len(text) and text[i-1].isalnum() and text[i+1].isalnum()))
    return ' '.join(text.split())

def edits(reference,hypothesis):
    # Each cell stores distance, substitutions, deletions, insertions.
    previous=[(i,0,0,i) for i in range(len(hypothesis)+1)]
    for j,r in enumerate(reference,1):
        current=[(j,0,j,0)]
        for i,h in enumerate(hypothesis,1):
            if r==h:current.append(previous[i-1]);continue
            d,s,x,y=previous[i-1];sub=(d+1,s+1,x,y)
            d,s,x,y=previous[i];delete=(d+1,s,x+1,y)
            d,s,x,y=current[i-1];insert=(d+1,s,x,y+1)
            current.append(min((sub,delete,insert),key=lambda v:v[0]))
        previous=current
    distance,s,d,i=previous[-1]
    return dict(substitutions=s,deletions=d,insertions=i,reference_count=len(reference),
                errors=distance,rate=distance/len(reference) if reference else None)

def score(reference,hypothesis):
    r,h=normalize(reference),normalize(hypothesis)
    if not r:raise ValueError('Empty normalized reference')
    return dict(normalized_reference=r,normalized_prediction=h,
                words=edits(r.split(),h.split()),characters=edits(r.replace(' ',''),h.replace(' ','')))

def aggregate(records):
    result={}
    for unit in ('words','characters'):
        totals={k:sum(r['metrics'][unit][k] for r in records) for k in
                ('substitutions','deletions','insertions','reference_count','errors')}
        totals['rate']=totals['errors']/totals['reference_count'] if totals['reference_count'] else None
        result[unit]=totals
    return result
