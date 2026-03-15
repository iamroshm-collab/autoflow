const fs=require('fs');
const s=fs.readFileSync('components/inventory/pos-sales.tsx','utf8');
const regex=/<(\/)?([A-Za-z0-9_:\-]+)([^>]*)>/g;
let m;const stack=[];let line=1;const lines=s.split('\n');
const posToLine=(pos)=>{let cur=0;for(let i=0;i<lines.length;i++){cur+=lines[i].length+1;if(pos<=cur) return i+1;}return lines.length;}
while((m=regex.exec(s))){const [full,close,tag,rest]=m;const idx=m.index;const ln=posToLine(idx);
 const selfClosing = /\/$/.test(rest) || /\/\s*>$/.test(full) || rest.trim().endsWith('/');
 if(!close && !selfClosing){stack.push({tag,ln});}
 else if(close){const top=stack[stack.length-1]; if(top && top.tag.toLowerCase()===tag.toLowerCase()){stack.pop();} else {console.log('Mismatch at line',ln,'closing',tag,'expected',top?top.tag:'<none>'); break;}}
}
if(stack.length>0){console.log('Unclosed tags (top first):');console.log(stack.slice().reverse().map(x=>x.tag+'@'+x.ln).join('\n'));}else{console.log('All tags matched');}
