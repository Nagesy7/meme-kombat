import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root='/workspace/meme-kombat', types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.ttf':'font/ttf'};
const srv=http.createServer((q,r)=>{let p=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});r.end(d);}});}).listen(0);
const b=await chromium.launch(), pg=await b.newPage({viewport:{width:1120,height:630}}); await pg.goto(`http://localhost:${srv.address().port}/?demo=1`); await pg.waitForTimeout(1500);
await pg.locator('#game').screenshot({path:root+'/share.png'}); await b.close(); srv.close();
