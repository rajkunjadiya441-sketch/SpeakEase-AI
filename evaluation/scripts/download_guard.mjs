export class DownloadBudget {
 constructor(records,{maxFiles,maxBytes},snapshot={}){
  this.allowed=new Map(records.map(row=>[row.id,row.content_length_bytes]));
  this.maxFiles=maxFiles;this.maxBytes=maxBytes;
  if(!Number.isSafeInteger(maxFiles)||maxFiles<1||!Number.isSafeInteger(maxBytes)||maxBytes<1)throw new Error('Invalid approval limits');
  const ids=snapshot.attempted_ids||[];
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!this.allowed.has(id)))throw new Error('Invalid saved request IDs');
  this.attempted=new Set(ids);
  this.reservedBytes=snapshot.reserved_bytes||0;this.receivedBytes=snapshot.received_bytes||0;
  const expected=ids.reduce((sum,id)=>sum+this.allowed.get(id),0);
  if(!Number.isSafeInteger(this.receivedBytes)||this.receivedBytes<0||this.reservedBytes!==expected||this.receivedBytes>this.reservedBytes||this.reservedBytes>maxBytes||ids.length>maxFiles)throw new Error('Invalid saved byte budget');
 }
 begin(id,bytes){
  if(this.allowed.get(id)!==bytes)throw new Error('ID or size is outside the frozen approval');
  if(this.attempted.has(id))throw new Error('Duplicate audio request refused');
  if(this.attempted.size+1>this.maxFiles)throw new Error('Audio file-count limit exceeded');
  if(this.reservedBytes+bytes>this.maxBytes)throw new Error('Audio byte reservation exceeds approval');
  this.attempted.add(id);this.reservedBytes+=bytes;
  return {id,expected:bytes,received:0};
 }
 receive(ticket,bytes){
  if(!Number.isSafeInteger(bytes)||bytes<0)throw new Error('Invalid byte count');
  if(ticket.received+bytes>ticket.expected||this.receivedBytes+bytes>this.maxBytes)throw new Error('Unexpected audio body exceeds the approved size');
  ticket.received+=bytes;this.receivedBytes+=bytes;
 }
 complete(ticket){if(ticket.received!==ticket.expected)throw new Error('Truncated audio body');}
 snapshot(){return {attempted_ids:[...this.attempted],audio_get_attempts:this.attempted.size,reserved_bytes:this.reservedBytes,received_bytes:this.receivedBytes,max_files:this.maxFiles,max_bytes:this.maxBytes};}
}
