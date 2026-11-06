"""Windows native counters and an owned-process job; standard library only."""
import ctypes
from ctypes import wintypes as w
import os
import time
import uuid

GiB = 1024**3
GATES = {'tiny': (GiB, 2*GiB), 'base.en': (5*GiB//4, 5*GiB//2)}

def gate(snapshot, model='tiny'):
    ram, commit = GATES[model]
    return {'passed': snapshot['available_ram_bytes'] >= ram and snapshot['commit_headroom_bytes'] >= commit,
            'required_available_ram_bytes': ram, 'required_commit_headroom_bytes': commit,
            'observed': snapshot}

class MemoryStatus(ctypes.Structure):
    _fields_ = [('length', w.DWORD), ('load', w.DWORD)] + [(name, ctypes.c_ulonglong) for name in
        ('total_phys', 'avail_phys', 'total_page', 'avail_page', 'total_virtual', 'avail_virtual', 'avail_extended')]

class ProcessCounters(ctypes.Structure):
    _fields_ = [('cb', w.DWORD), ('faults', w.DWORD)] + [(name, ctypes.c_size_t) for name in
        ('peak_ws', 'ws', 'peak_paged', 'paged', 'peak_nonpaged', 'nonpaged', 'commit', 'peak_commit', 'private')]

class PerformanceInfo(ctypes.Structure):
    _fields_ = [('cb', w.DWORD)] + [(name, ctypes.c_size_t) for name in
        ('commit_total','commit_limit','commit_peak','physical_total','physical_available','system_cache','kernel_total','kernel_paged','kernel_nonpaged','page_size')] + [('handles',w.DWORD),('processes',w.DWORD),('threads',w.DWORD)]

class NativeMemory:
    def __init__(self):
        if os.name != 'nt':
            raise RuntimeError('Windows counters are required; memory checks fail closed')
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        self.psapi = ctypes.WinDLL('psapi', use_last_error=True)
        self.kernel.GlobalMemoryStatusEx.argtypes = [ctypes.POINTER(MemoryStatus)]
        self.kernel.GlobalMemoryStatusEx.restype = w.BOOL
        self.kernel.GetCurrentProcess.restype = w.HANDLE
        self.kernel.OpenProcess.argtypes = [w.DWORD,w.BOOL,w.DWORD]
        self.kernel.OpenProcess.restype = w.HANDLE
        self.kernel.CloseHandle.argtypes = [w.HANDLE]
        self.psapi.GetPerformanceInfo.argtypes = [ctypes.POINTER(PerformanceInfo), w.DWORD]
        self.psapi.GetPerformanceInfo.restype = w.BOOL
        self.psapi.GetProcessMemoryInfo.argtypes = [w.HANDLE, ctypes.POINTER(ProcessCounters), w.DWORD]
        self.psapi.GetProcessMemoryInfo.restype = w.BOOL

    def system(self):
        m = MemoryStatus(); m.length = ctypes.sizeof(m)
        p = PerformanceInfo(); p.cb = ctypes.sizeof(p)
        if not self.kernel.GlobalMemoryStatusEx(ctypes.byref(m)) or not self.psapi.GetPerformanceInfo(ctypes.byref(p), p.cb):
            raise ctypes.WinError(ctypes.get_last_error())
        return {'available_ram_bytes':m.avail_phys,'total_ram_bytes':m.total_phys,
                'commit_headroom_bytes':(p.commit_limit-p.commit_total)*p.page_size,
                'committed_bytes':p.commit_total*p.page_size,'commit_limit_bytes':p.commit_limit*p.page_size}

    def process(self, pid=None):
        own = pid is None or pid == os.getpid()
        handle = self.kernel.GetCurrentProcess() if own else self.kernel.OpenProcess(0x410, False, pid)
        if not handle:
            raise ctypes.WinError(ctypes.get_last_error())
        try:
            p = ProcessCounters(); p.cb = ctypes.sizeof(p)
            if not self.psapi.GetProcessMemoryInfo(handle, ctypes.byref(p), p.cb):
                raise ctypes.WinError(ctypes.get_last_error())
            return {'pid':os.getpid() if own else pid,'working_set_bytes':p.ws,'peak_working_set_bytes':p.peak_ws,
                    'private_commit_bytes':p.private,'peak_private_commit_bytes':p.peak_commit,
                    'page_fault_count_including_soft_faults':p.faults}
        finally:
            if not own:
                self.kernel.CloseHandle(handle)

class PdhValue(ctypes.Union):
    _fields_ = [('doubleValue',ctypes.c_double),('longValue',w.LONG),('largeValue',ctypes.c_longlong)]
class FormattedCounter(ctypes.Structure):
    _fields_ = [('status',w.DWORD),('value',PdhValue)]

class PagingCounters:
    """Rate counters: first sample unavailable; hard reads include mapped files."""
    NAMES = {'pages_input_per_sec':'Pages Input/sec','page_reads_per_sec':'Page Reads/sec',
             'pages_output_per_sec':'Pages Output/sec','page_writes_per_sec':'Page Writes/sec'}
    def __init__(self):
        self.error = None; self.query = w.HANDLE(); self.counters = {}; self.count = 0
        try:
            self.dll = ctypes.WinDLL('pdh')
            self.dll.PdhOpenQueryW.argtypes = [w.LPCWSTR,ctypes.c_size_t,ctypes.POINTER(w.HANDLE)]
            self.dll.PdhAddEnglishCounterW.argtypes = [w.HANDLE,w.LPCWSTR,ctypes.c_size_t,ctypes.POINTER(w.HANDLE)]
            self.dll.PdhCollectQueryData.argtypes = [w.HANDLE]
            self.dll.PdhGetFormattedCounterValue.argtypes = [w.HANDLE,w.DWORD,ctypes.POINTER(w.DWORD),ctypes.POINTER(FormattedCounter)]
            self.dll.PdhCloseQuery.argtypes = [w.HANDLE]
            if self.dll.PdhOpenQueryW(None,0,ctypes.byref(self.query)):
                raise RuntimeError('PDH query unavailable')
            for key,name in self.NAMES.items():
                handle = w.HANDLE()
                if self.dll.PdhAddEnglishCounterW(self.query,'\\Memory\\'+name,0,ctypes.byref(handle)):
                    raise RuntimeError('PDH counter unavailable: '+name)
                self.counters[key] = handle
        except Exception as exc:
            self.error = str(exc)

    def sample(self):
        if self.error:
            return {'available':False,'error':self.error}
        if self.dll.PdhCollectQueryData(self.query):
            return {'available':False,'error':'PDH collection failed'}
        self.count += 1
        values = {}
        for key,handle in self.counters.items():
            value = FormattedCounter()
            status = self.dll.PdhGetFormattedCounterValue(handle,0x200,None,ctypes.byref(value))
            values[key] = value.value.doubleValue if not status and value.status in (0,1) and self.count > 1 else None
        return {'available':any(v is not None for v in values.values()),**values}

    def close(self):
        if self.query:
            self.dll.PdhCloseQuery(self.query); self.query = w.HANDLE()

class BasicLimits(ctypes.Structure):
    _fields_ = [('process_time',ctypes.c_longlong),('job_time',ctypes.c_longlong),('flags',w.DWORD),
        ('min_ws',ctypes.c_size_t),('max_ws',ctypes.c_size_t),('active_processes',w.DWORD),
        ('affinity',ctypes.c_size_t),('priority',w.DWORD),('scheduling',w.DWORD)]
class IOCounters(ctypes.Structure):
    _fields_ = [(name,ctypes.c_ulonglong) for name in ('read_ops','write_ops','other_ops','read_bytes','write_bytes','other_bytes')]
class ExtendedLimits(ctypes.Structure):
    _fields_ = [('basic',BasicLimits),('io',IOCounters)] + [(name,ctypes.c_size_t) for name in
        ('process_limit','job_limit','peak_process','peak_job')]

class OwnedJob:
    """Only this runner's child tree is terminated on close/interruption."""
    def __init__(self):
        self.dll = ctypes.WinDLL('kernel32',use_last_error=True)
        self.dll.CreateJobObjectW.argtypes = [ctypes.c_void_p,w.LPCWSTR]; self.dll.CreateJobObjectW.restype = w.HANDLE
        self.dll.SetInformationJobObject.argtypes = [w.HANDLE,ctypes.c_int,ctypes.c_void_p,w.DWORD]
        self.dll.SetInformationJobObject.restype = w.BOOL
        self.dll.AssignProcessToJobObject.argtypes = [w.HANDLE,w.HANDLE]; self.dll.AssignProcessToJobObject.restype = w.BOOL
        self.dll.CloseHandle.argtypes = [w.HANDLE]
        self.name = 'Local\\SpeakEaseEval_'+uuid.uuid4().hex
        self.handle = self.dll.CreateJobObjectW(None,self.name)
        limits = ExtendedLimits(); limits.basic.flags = 0x2000
        if not self.handle or not self.dll.SetInformationJobObject(self.handle,9,ctypes.byref(limits),ctypes.sizeof(limits)):
            self.close(); raise ctypes.WinError(ctypes.get_last_error())

    @staticmethod
    def join_current(name):
        if not name or not name.startswith('Local\\SpeakEaseEval_'):
            raise RuntimeError('Missing supervised job name')
        dll=ctypes.WinDLL('kernel32',use_last_error=True)
        dll.OpenJobObjectW.argtypes=[w.DWORD,w.BOOL,w.LPCWSTR];dll.OpenJobObjectW.restype=w.HANDLE
        dll.GetCurrentProcess.restype=w.HANDLE
        dll.IsProcessInJob.argtypes=[w.HANDLE,w.HANDLE,ctypes.POINTER(w.BOOL)];dll.IsProcessInJob.restype=w.BOOL
        dll.AssignProcessToJobObject.argtypes=[w.HANDLE,w.HANDLE];dll.AssignProcessToJobObject.restype=w.BOOL
        dll.CloseHandle.argtypes=[w.HANDLE]
        handle=dll.OpenJobObjectW(0x0001|0x0004,False,name)
        if not handle:raise ctypes.WinError(ctypes.get_last_error())
        try:
            member=w.BOOL()
            if not dll.IsProcessInJob(dll.GetCurrentProcess(),handle,ctypes.byref(member)):
                raise ctypes.WinError(ctypes.get_last_error())
            if not member.value and not dll.AssignProcessToJobObject(handle,dll.GetCurrentProcess()):
                raise ctypes.WinError(ctypes.get_last_error())
        finally:dll.CloseHandle(handle)

    def assign(self, process):
        if not self.dll.AssignProcessToJobObject(self.handle,w.HANDLE(int(process._handle))):
            raise ctypes.WinError(ctypes.get_last_error())

    def close(self):
        if self.handle:
            self.dll.CloseHandle(self.handle); self.handle = None

class PressureGuard:
    def __init__(self, seconds=5):
        self.seconds = seconds; self.low_since = None
    def update(self, sample, now):
        low = sample['available_ram_bytes'] < 256*1024**2 or sample['commit_headroom_bytes'] < 512*1024**2
        if not low:
            self.low_since = None
        elif self.low_since is None:
            self.low_since = now
        return self.low_since is not None and now-self.low_since >= self.seconds
