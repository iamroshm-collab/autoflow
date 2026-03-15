const fs=require('fs');
const s=fs.readFileSync('components/inventory/pos-sales.tsx','utf8');
let i=0;const results=[];
while((i=s.indexOf('<Input',i))!==-1){
  let j=i;let inSingle=false,inDouble=false;let ch;
  while(j<s.length){
    ch=s[j];
    if(ch==="'" && !inDouble) inSingle=!inSingle;
    else if(ch==='"' && !inSingle) inDouble=!inDouble;
    if(ch==='>' && !inSingle && !inDouble) break;
    j++;
  }
  const tag=s.slice(i,j+1);
  const line=s.slice(0,i).split('\n').length;
  const selfClosing=/\/\s*>$/.test(tag);
  results.push({line,selfClosing,tag:tag.replace(/\n/g,' ')});
  i=j+1;
}
console.log(JSON.stringify(results,null,2));
