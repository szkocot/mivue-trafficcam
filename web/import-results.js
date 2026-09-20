export function renderImportResults(element,summary,{t}){
 element.replaceChildren();element.hidden=!summary;if(!summary)return;
 for(const text of [t('importSummary'),t('importCounts',summary),t('importOverlap')]){const p=document.createElement('p');p.textContent=text;element.append(p);}
 const reasons=new Map();for(const item of summary.items)for(const code of item.codes)reasons.set(code,(reasons.get(code)??0)+1);
 for(const [code,count] of reasons){const p=document.createElement('p');p.textContent=`${t(code)}: ${count}`;element.append(p);}
}
