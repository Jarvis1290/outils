/* Kardex : l'IA du relief (Depth Anything V2 small, ONNX Runtime Web) tourne ici, à part, pour que l'app reste fluide.
   Reçoit {id, inp (Float32Array 3×N×N), n, dir, parts, total} ; renvoie {t:"prog"} pendant le chargement, puis {t:"ok", id, d} ou {t:"err", id, msg}. */
let sess=null,loading=null;
async function load(m){
  if(!self.ort)importScripts(m.dir+"ort.wasm.min.js");
  ort.env.wasm.wasmPaths=m.dir;ort.env.wasm.numThreads=1;
  const parts=[];let got=0;
  for(const f of m.parts){const r=await fetch(m.dir+f);if(!r.ok)throw new Error("modèle IA introuvable (connexion ?)");const rd=r.body.getReader();
    for(;;){const {done,value}=await rd.read();if(done)break;parts.push(value);got+=value.length;
      postMessage({t:"prog",p:Math.min(.9,got/m.total*.9),msg:`Téléchargement de l'IA : ${(got/1048576).toFixed(0)} / ${(m.total/1048576).toFixed(0)} Mo (une seule fois)`})}}
  const buf=new Uint8Array(got);let o=0;for(const q of parts){buf.set(q,o);o+=q.length}
  postMessage({t:"prog",p:.92,msg:"Démarrage de l'IA"});
  return ort.InferenceSession.create(buf,{executionProviders:["wasm"],graphOptimizationLevel:"all"})}
onmessage=async e=>{const m=e.data;
  try{if(!sess){loading=loading||load(m);sess=await loading}
    postMessage({t:"prog",p:.95,msg:"L'IA mesure la profondeur…"});
    const out=await sess.run({[sess.inputNames[0]]:new ort.Tensor("float32",m.inp,[1,3,m.n,m.n])}),d=new Float32Array(out[sess.outputNames[0]].data);
    postMessage({t:"ok",id:m.id,d},[d.buffer])}
  catch(err){loading=null;postMessage({t:"err",id:m.id,msg:String(err&&err.message||err)})}};
