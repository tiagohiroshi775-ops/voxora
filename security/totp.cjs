'use strict';
const crypto=require('node:crypto');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function encodeBase32(bytes){let bits=0,value=0,out='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out;}
function newSecret(){return crypto.randomBytes(20);}
function codeAt(secret,step){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const digest=crypto.createHmac('sha1',secret).update(counter).digest();const offset=digest[digest.length-1]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
function verify(secret,code,{now=Date.now(),lastStep=-1}={}){if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;const step=Math.floor(now/30000);for(const candidate of [step,step-1,step+1]){if(candidate<0||candidate<=lastStep)continue;if(crypto.timingSafeEqual(Buffer.from(code),Buffer.from(codeAt(secret,candidate))))return candidate;}return null;}
function seal(secret,key){if(!Buffer.isBuffer(key)||key.length!==32)throw Error('Invalid 2FA encryption key');const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(secret),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');}
function unseal(value,key){if(!Buffer.isBuffer(key)||key.length!==32)throw Error('Invalid 2FA encryption key');const data=Buffer.from(value,'base64');if(data.length!==48)throw Error('Invalid encrypted secret');const cipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]);}
module.exports={encodeBase32,newSecret,codeAt,verify,seal,unseal};
