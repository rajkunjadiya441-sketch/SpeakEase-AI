// Binary audio lives in IndexedDB; localStorage retains the existing attempt metadata.
const DATABASE = 'adaptsynthetix_recordings_v1';
const STORE = 'recordings';
const failure = cause => new Error('Recording storage is full or unavailable. Keep this page open and retry saving, or free browser storage.', { cause });
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(failure()); return; }
    let request, settled = false;
    const timeout = setTimeout(() => { settled = true; reject(failure()); }, 10000);
    try { request = indexedDB.open(DATABASE, 1); }
    catch (error) { clearTimeout(timeout); reject(failure(error)); return; }
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => { clearTimeout(timeout); if (settled) request.result.close(); else { settled = true; request.result.onversionchange = () => request.result.close(); resolve(request.result); } };
    request.onerror = () => { clearTimeout(timeout); settled = true; reject(failure(request.error)); };
    request.onblocked = () => { clearTimeout(timeout); settled = true; reject(failure()); };
  });
}
async function transact(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    let result;
    try {
      const transaction = database.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { database.close(); resolve(result); };
      transaction.onabort = transaction.onerror = () => { database.close(); reject(failure(transaction.error)); };
    } catch (error) { database.close(); reject(failure(error)); }
  });
}
export const recordingStore = {
  async put(id, blob) {
    if (!id || !(blob instanceof Blob) || !blob.size) throw new Error('Cannot save an empty recording.');
    await transact('readwrite', store => store.put(blob, id));
  },
  async get(id) {
    const blob = await transact('readonly', store => store.get(id));
    if (blob == null) return null;
    if (!(blob instanceof Blob) || !blob.size) throw new Error('The saved recording is empty or damaged.');
    return blob;
  },
  remove: id => transact('readwrite', store => store.delete(id)),
  clear: () => transact('readwrite', store => store.clear()),
};
