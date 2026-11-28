const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const t=require('../security/totp.cjs');
test('TOTP standard vectors and replay rejection',()=>{
const secret=Buffer.from('12345678901234567890');
assert.equal(t.encodeBase32(secret),'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
assert.equal(t.codeAt(secret,1),'287082');
assert.equal(t.verify(secret,'287082',{now:59000}),1);
assert.equal(t.verify(secret,'287082',{now:59000,lastStep:1}),null);
assert.equal(t.verify(secret,'287082',{now:180000}),null);
assert.equal(t.verify(secret,'abc',{now:59000}),null);
});
test('TOTP secrets encrypted and authenticated',()=>{
const key=crypto.randomBytes(32),secret=t.newSecret();
const encrypted=t.seal(secret,key);
assert.deepEqual(t.unseal(encrypted,key),secret);
assert.notEqual(t.seal(secret,key),encrypted);
assert.throws(()=>t.unseal(encrypted,crypto.randomBytes(32)));
const data=Buffer.from(encrypted,'base64');data[30]^=1;
assert.throws(()=>t.unseal(data.toString('base64'),key));
});
