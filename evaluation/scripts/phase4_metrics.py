"""Reference-gated alignment metrics and ambiguity-safe lexical matching; stdlib only."""
import math
import statistics
import unicodedata

POLICY='phase4-v1; whitespace tokens; NFKC casefold; lexical-only optimal edit paths; mandatory exact matches only'
VERIFIED={'verified','adjudicated'}
STATUSES={'pending','annotated','uncertain','inaudible','unresolved_transcript','excluded_punctuation',*VERIFIED}
ACCURACY_KEYS=('start_mae_seconds','end_mae_seconds','combined_boundary_mae_seconds','median_absolute_boundary_error_seconds',
    'boundaries_within_100ms_percent','boundaries_within_200ms_percent','all_reference_boundaries_within_100ms_percent','all_reference_boundaries_within_200ms_percent')

def token(text):
    text=unicodedata.normalize('NFKC',text).casefold().translate(str.maketrans({'\u2019':"'",'\u2018':"'",'\u02bc':"'"}))
    return ''.join(c for i,c in enumerate(text) if c.isalnum() or (c=="'" and i>0 and i+1<len(text) and text[i-1].isalnum() and text[i+1].isalnum()))

def mandatory_matches(reference,predicted):
    """An exact-match edge is usable only when every optimal edit path uses it."""
    n,m=len(reference),len(predicted)
    f=[[0]*(m+1) for _ in range(n+1)];fc=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n+1):f[i][0]=i;fc[i][0]=1
    for j in range(m+1):f[0][j]=j;fc[0][j]=1
    for i in range(1,n+1):
        for j in range(1,m+1):
            options=[(f[i-1][j-1]+(reference[i-1]!=predicted[j-1]),fc[i-1][j-1]),(f[i-1][j]+1,fc[i-1][j]),(f[i][j-1]+1,fc[i][j-1])]
            best=min(v for v,c in options);f[i][j]=best;fc[i][j]=sum(c for v,c in options if v==best)
    b=[[0]*(m+1) for _ in range(n+1)];bc=[[0]*(m+1) for _ in range(n+1)]
    for i in range(n,-1,-1):b[i][m]=n-i;bc[i][m]=1
    for j in range(m,-1,-1):b[n][j]=m-j;bc[n][j]=1
    for i in range(n-1,-1,-1):
        for j in range(m-1,-1,-1):
            options=[(b[i+1][j+1]+(reference[i]!=predicted[j]),bc[i+1][j+1]),(b[i+1][j]+1,bc[i+1][j]),(b[i][j+1]+1,bc[i][j+1])]
            best=min(v for v,c in options);b[i][j]=best;bc[i][j]=sum(c for v,c in options if v==best)
    mapping={};ambiguous=set()
    for i in range(n):
        for j in range(m):
            if reference[i]==predicted[j] and f[i][j]+b[i+1][j+1]==f[n][m]:
                if fc[i][j]*bc[i+1][j+1]==fc[n][m]:mapping[i]=j
                else:ambiguous.add(i)
    return mapping,ambiguous-set(mapping),fc[n][m]

def number(value):
    if value is None or value=='':return None
    if isinstance(value,bool):raise ValueError('Boolean timestamp is invalid')
    result=float(value)
    if not math.isfinite(result):raise ValueError('Timestamp must be finite')
    return result

def validate_annotations(words,rows,duration,recording_id):
    if len(rows)!=len(words):raise ValueError('Annotation row count differs')
    out=[];previous_end=0.0
    for index,(word,row) in enumerate(zip(words,rows),1):
        if row.get('recording_id')!=recording_id or int(row.get('word_index',0))!=index or row.get('word')!=word:
            raise ValueError('Annotation ID/index/original word differs')
        status=row.get('annotation_status')
        if status not in STATUSES:raise ValueError('Unknown annotation status')
        start,end=number(row.get('reference_start_seconds')),number(row.get('reference_end_seconds'))
        if status in VERIFIED:
            if not token(word) or start is None or end is None or not (0<=start<end<=duration) or start<previous_end:
                raise ValueError('Verified reference requires ordered, valid, positive intervals')
            annotator=row.get('annotator_id','').strip();reviewer=row.get('reviewer_id','').strip()
            if not annotator or not reviewer or annotator==reviewer:raise ValueError('Independent annotator and reviewer IDs required')
            previous_end=end
        out.append({**row,'reference_start_seconds':start,'reference_end_seconds':end})
    return out

def accuracy(start_errors,end_errors,total_reference_words):
    result={key:None for key in ACCURACY_KEYS};pooled=start_errors+end_errors
    if pooled:
        result.update(start_mae_seconds=statistics.mean(start_errors),end_mae_seconds=statistics.mean(end_errors),
            combined_boundary_mae_seconds=statistics.mean(pooled),median_absolute_boundary_error_seconds=statistics.median(pooled),
            boundaries_within_100ms_percent=100*sum(e<=.100+1e-9 for e in pooled)/len(pooled),
            boundaries_within_200ms_percent=100*sum(e<=.200+1e-9 for e in pooled)/len(pooled))
    if total_reference_words:
        result.update(all_reference_boundaries_within_100ms_percent=100*sum(e<=.100+1e-9 for e in pooled)/(2*total_reference_words),
            all_reference_boundaries_within_200ms_percent=100*sum(e<=.200+1e-9 for e in pooled)/(2*total_reference_words))
    return result

def evaluate(recording_id,reference_text,predictions,annotations,duration,allow_accuracy=True):
    words=reference_text.split();refs=validate_annotations(words,annotations,duration,recording_id)
    indices=[i for i,w in enumerate(words) if token(w)];pred_indices=[i for i,p in enumerate(predictions) if token(p['word'])]
    mapping,ambiguous,paths=mandatory_matches([token(words[i]) for i in indices],[token(predictions[i]['word']) for i in pred_indices])
    validity={};last=-1.0
    for i in pred_indices:
        p=predictions[i]
        try:
            a,b=number(p.get('start')),number(p.get('end'))
            ok=a is not None and b is not None and 0<=a<b<=duration+.01 and a>=last
        except (ValueError,TypeError):ok=False
        validity[i]=ok
        if ok:last=a
    references_complete=bool(indices) and all(refs[i]['annotation_status'] in VERIFIED for i in indices)
    complete=allow_accuracy and references_complete
    matched=0;start_errors=[];end_errors=[];rows=[]
    for position,index in enumerate(indices):
        j=pred_indices[mapping[position]] if position in mapping else None
        state='ambiguous_lexical_match' if position in ambiguous else 'missing_or_unmatched'
        if j is not None:state='matched_valid_time' if validity[j] else 'invalid_timestamp'
        detail={'word_index':index+1,'word':words[index],'match_status':state,'prediction_index':j,'start_error_seconds':None,'end_error_seconds':None}
        if state=='matched_valid_time':
            matched+=1
            if complete:
                a=abs(float(predictions[j]['start'])-refs[index]['reference_start_seconds']);b=abs(float(predictions[j]['end'])-refs[index]['reference_end_seconds'])
                start_errors.append(a);end_errors.append(b);detail.update(start_error_seconds=a,end_error_seconds=b)
        rows.append(detail)
    result={'recording_id':recording_id,'policy':POLICY,'target_words':len(indices),'uniquely_aligned_words':matched,
        'word_alignment_coverage':matched/len(indices) if indices else None,'ambiguous_target_words':len(ambiguous),
        'missing_or_invalid_target_words':len(indices)-matched,'prediction_words_with_valid_intervals':sum(validity.values()),
        'optimal_lexical_path_count':str(paths),'accuracy_status':'verified_reference' if complete else 'disabled_performance_only' if not allow_accuracy else 'unavailable_unverified_references',
        'reference_verification_complete':references_complete,
        'verified_reference_words':sum(refs[i]['annotation_status'] in VERIFIED for i in indices),'word_results':rows,
        'start_errors_seconds':start_errors,'end_errors_seconds':end_errors,'scored_word_pairs':len(start_errors)}
    result.update(accuracy(start_errors,end_errors,len(indices)) if complete else {key:None for key in ACCURACY_KEYS})
    return result

def aggregate(results):
    eligible=[r for r in results if r['accuracy_status']=='verified_reference'];start=[e for r in eligible for e in r['start_errors_seconds']];end=[e for r in eligible for e in r['end_errors_seconds']]
    total=sum(r['target_words'] for r in results);aligned=sum(r['uniquely_aligned_words'] for r in results)
    result={'recordings':len(results),'fully_verified_reference_recordings':sum(bool(r.get('reference_verification_complete')) for r in results),'accuracy_eligible_recordings':len(eligible),'accuracy_scope':'unavailable' if not eligible else 'verified subset' if len(eligible)<len(results) else 'all supplied recordings',
        'target_words':total,'uniquely_aligned_words':aligned,'word_alignment_coverage':aligned/total if total else None,'scored_word_pairs':len(start)}
    result.update(accuracy(start,end,sum(r['target_words'] for r in eligible)) if eligible else {key:None for key in ACCURACY_KEYS})
    return result
