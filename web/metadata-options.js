export function createMetadataOptions({storage,onChange,t}){
 const element=document.getElementById('metadata-options'),values={showSpeedLimits:false,showMetadata:false};
 try{const saved=JSON.parse(storage?.getItem('mivue-display')??'{}');for(const k of Object.keys(values))values[k]=saved?.[k]===true;}catch{}
 function render(){element.replaceChildren();for(const key of Object.keys(values)){
  const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=values[key];
  input.onchange=()=>{values[key]=input.checked;try{storage?.setItem('mivue-display',JSON.stringify(values));}catch{}onChange({...values});};
  label.append(input,document.createTextNode(t(key)));element.append(label);
 }}
 render();onChange({...values});return {get values(){return {...values};},setLanguage:render,destroy(){element.replaceChildren();}};
}
