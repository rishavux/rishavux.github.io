# Builds one self-contained HTML per width for Figma's html_to_figma: images inlined,
# media queries and vw/vh/clamp() resolved for that width, motion and page scripts removed.
# Usage: python3 tools/figma-capture.py <output folder>
import re, base64, sys, os
SITE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=sys.argv[1]
css=open(f'{SITE}/style.css').read()
html=open(f'{SITE}/index.html').read()
mime={'png':'image/png','webp':'image/webp','jpg':'image/jpeg'}
space={f'--space-{i+1}':v for i,v in enumerate([8,16,24,32,48,64,96,128,160,200])}

def media_blocks(s):
    i=0
    while True:
        j=s.find('@media',i)
        if j<0: return
        k=s.index('{',j); depth=1; n=k+1
        while depth:
            depth += {'{':1,'}':-1}.get(s[n],0); n+=1
        yield j,n,s[j+6:k].strip(),s[k+1:n-1]
        i=n

def applies(q,W):
    if 'prefers-reduced-motion' in q: return False   # capture the settled, motionless page
    mx=re.search(r'max-width:\s*(\d+)px',q); mn=re.search(r'min-width:\s*(\d+)px',q)
    return (not mx or W<=int(mx.group(1))) and (not mn or W>=int(mn.group(1)))

def px(v,W):
    v=v.strip()
    m=re.fullmatch(r'var\((--space-\d+)\)',v)
    if m: return space[m.group(1)]
    if v.endswith('rem'): return float(v[:-3])*16
    if v.endswith('vw'): return float(v[:-2])*W/100
    if v.endswith('px'): return float(v[:-2])
    raise ValueError(v)

def for_width(W,H):
    out=[];last=0
    for a,b,q,body in list(media_blocks(css)):
        out.append(css[last:a])
        if applies(q,W): out.append(body)
        last=b
    out.append(css[last:]); c=''.join(out)
    c=re.sub(r'clamp\(([^()]*(?:\([^()]*\)[^()]*)*)\)', lambda m: '%gpx'%round(
        (lambda lo,mid,hi: max(lo,min(mid,hi)))(*[px(x,W) for x in re.split(r',(?![^(]*\))',m.group(1))]),2), c)
    c=re.sub(r'(\d+(?:\.\d+)?)vh', lambda m:'%gpx'%(float(m.group(1))*H/100), c)
    c=c.replace('background:rgba(21, 21, 21, .85); /* ink/900 at 85% */','background:var(--ink-900);')
    c=c.replace('backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);','')
    c=c.replace('position:sticky; top:0;','position:relative;')
    c+=f'\nhtml,body{{width:{W}px;margin:0;}}\n'
    assert 'clamp(' not in c and 'vw' not in re.sub(r'/\*.*?\*/','',c,flags=re.S), 'unresolved units'
    h=html.replace('<html lang="en">','<html lang="en" class="js">')
    h=h.replace("  <script>document.documentElement.classList.add('js')</script>\n",'')
    h=h.replace('<link rel="stylesheet" href="style.css" />',f'<style>\n{c}\n</style>')
    h=h.replace('<script src="script.js"></script>','')
    h=h.replace(' loading="lazy"','')
    h=re.sub(r'src="(images/[^"]+)"',lambda m:'src="data:%s;base64,%s"'%(mime[m.group(1).rsplit('.',1)[1]],base64.b64encode(open(f'{SITE}/{m.group(1)}','rb').read()).decode()),h)
    assert '<script' not in h
    return h

for name,W,H in [('desktop',1440,900),('tablet',768,1024),('mobile',375,812)]:
    p=f'{OUT}/{name}.html'; open(p,'w').write(for_width(W,H)); print(name,W,os.path.getsize(p))
