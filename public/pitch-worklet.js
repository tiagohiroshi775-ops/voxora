class VoxoraPitch extends AudioWorkletProcessor {
 static get parameterDescriptors(){return [{name:'semitones',defaultValue:0,minValue:-6,maxValue:6,automationRate:'k-rate'}]}
 constructor(){super();this.size=32768;this.buf=new Float32Array(this.size);this.w=0;this.phase=0;this.mix=0}
 process(inputs,outputs,params){
 const input=inputs[0]?.[0],out=outputs[0]?.[0];if(!out)return true;
 const steps=params.semitones[0],ratio=2**(steps/12),span=Math.round(sampleRate*.055),base=32;
 for(let i=0;i<out.length;i++){const x=input?.[i]||0;this.buf[this.w]=x;
 this.phase=(this.phase+(1-ratio)/span+1)%1;
 const p=this.phase,q=(p+.5)%1;
 const read=d=>{const j=(this.w-d+this.size)%this.size,k=Math.floor(j),f=j-k;return this.buf[k]*(1-f)+this.buf[(k+1)%this.size]*f};
 const weight=.5-.5*Math.cos(2*Math.PI*p);
 const wet=read(base+p*span)*weight+read(base+q*span)*(1-weight);
 this.mix+=(Number(Math.abs(steps)>.001)-this.mix)*.01;
 out[i]=x*(1-this.mix)+wet*this.mix;this.w=(this.w+1)%this.size;
 }return true;
 }}
registerProcessor('voxora-pitch',VoxoraPitch);