const urls=new Set();
export function downloadBlob({bytes,mime,filename}){
 const url=URL.createObjectURL(new Blob([bytes],{type:mime}));urls.add(url);
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
 setTimeout(()=>{URL.revokeObjectURL(url);urls.delete(url);},1000);
}
export function releaseDownloads(){for(const url of urls)URL.revokeObjectURL(url);urls.clear();}
