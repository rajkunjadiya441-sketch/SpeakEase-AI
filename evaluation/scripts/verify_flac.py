"""Decode-only verification using existing PyAV; no model imports or audio writes."""
import hashlib
import json
import pathlib
import re
import sys
import av

DATA = pathlib.Path(__file__).resolve().parents[1] / 'data'

def verify(source, expected_id):
    source = pathlib.Path(source).resolve(strict=True)
    if not source.is_relative_to(DATA.resolve()) or not re.fullmatch(r'\d+-\d+-\d{4}', expected_id) or source.name != expected_id + '.flac':
        raise ValueError('Audio path/ID does not match the evaluation dataset')
    raw = source.read_bytes()
    if raw[:4] != b'fLaC':
        raise ValueError('Source is not native FLAC')
    offset, streaminfo = 4, None
    while offset < len(raw):
        header = raw[offset:offset+4]
        if len(header) != 4:
            raise ValueError('Truncated FLAC metadata')
        length = int.from_bytes(header[1:4], 'big')
        block = raw[offset+4:offset+4+length]
        if len(block) != length:
            raise ValueError('Truncated FLAC metadata block')
        if header[0] & 127 == 0:
            if len(block) != 34:
                raise ValueError('Invalid STREAMINFO')
            streaminfo = block
        offset += 4 + length
        if header[0] & 128:
            break
    if streaminfo is None:
        raise ValueError('Missing FLAC STREAMINFO')
    packed = int.from_bytes(streaminfo[10:18], 'big')
    rate = packed >> 44
    channels = ((packed >> 41) & 7) + 1
    bits = ((packed >> 36) & 31) + 1
    declared_samples = packed & ((1 << 36)-1)
    expected_md5 = streaminfo[18:34].hex()
    pcm_md5 = hashlib.md5()
    samples, frame_count = 0, 0
    checksum_supported = bits == 16
    with av.open(str(source), mode='r', format='flac', options={'err_detect':'explode'}) as container:
        if len(container.streams) != 1 or len(container.streams.audio) != 1:
            raise ValueError('Expected one audio stream')
        stream = container.streams.audio[0]
        codec = stream.codec_context.name
        stream.codec_context.thread_count = 1
        for frame in container.decode(stream):
            if frame.sample_rate != rate or len(frame.layout.channels) != channels or frame.samples <= 0:
                raise ValueError('Frame/STREAMINFO format mismatch')
            samples += frame.samples
            frame_count += 1
            if checksum_supported:
                array = frame.to_ndarray()
                if array.dtype.kind != 'i' or array.dtype.itemsize != 2:
                    raise ValueError('Unexpected PCM representation')
                if frame.format.is_planar and channels > 1:
                    array = array.T
                pcm_md5.update(array.astype('<i2', copy=False).tobytes(order='C'))
    if rate <= 0 or samples <= 0 or not frame_count:
        raise ValueError('No decoded audio')
    if declared_samples and samples != declared_samples:
        raise ValueError('Decoded sample count differs from STREAMINFO')
    checksum_present = expected_md5 != '0'*32
    checksum_ok = pcm_md5.hexdigest() == expected_md5 if checksum_supported and checksum_present else None
    if checksum_ok is False:
        raise ValueError('FLAC decoded PCM MD5 mismatch')
    duration = samples/rate
    reasons = []
    if duration > 30 + 1e-6:
        reasons.append('duration_exceeds_30_seconds')
    if (rate, channels, bits) != (16000, 1, 16):
        reasons.append('source_format_requires_separate_review')
    if source.stat().st_size != len(raw) or hashlib.sha256(source.read_bytes()).hexdigest() != hashlib.sha256(raw).hexdigest():
        raise ValueError('Source changed during verification')
    return {'id':expected_id,'decode_success':True,'codec':codec,'sample_rate':rate,'channels':channels,'bits_per_sample':bits,'decoded_samples':samples,'streaminfo_samples':declared_samples,'frame_count':frame_count,'duration_seconds':duration,'flac_pcm_md5_present':checksum_present,'flac_pcm_md5_verified':checksum_ok,'flac_pcm_md5':expected_md5,'source_sha256':hashlib.sha256(raw).hexdigest(),'source_bytes':len(raw),'source_unchanged':True,'eligible':not reasons,'exclusion_reasons':reasons,'pyav_version':av.__version__,'models_imported':False}

try:
    result = verify(sys.argv[1], sys.argv[2])
    print(json.dumps(result, allow_nan=False))
except Exception as exc:
    print(json.dumps({'decode_success':False,'eligible':False,'error':type(exc).__name__+': '+str(exc)}, allow_nan=False))
    sys.exit(1)
