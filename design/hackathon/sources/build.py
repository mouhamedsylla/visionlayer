# build.py <out> <title> <nav label actif> <fichier css> <fichier main> <hauteur>
import sys,re
out,title,active,cssf,mainf,h=sys.argv[1:7]
src=open('canvas/project/Carte.dc.html').read()
head=src[:src.index('  <main ')]
head=re.sub(r'<title>.*?</title>','<title>'+title+'</title>',head)
head=head.replace('min-height: 1430px','min-height: '+h+'px')
head=head.replace('class="vl-nav vl-nav--active"','class="vl-nav"')
i=head.index('<span>'+active+'</span>'); j=head.rindex('class="vl-nav"',0,i)
head=head[:j]+'class="vl-nav vl-nav--active"'+head[j+len('class="vl-nav"'):]
a=head.index('.seg{'); b=head.index('</style>')
base=head[a:b]
head=head[:a]+open('css-commun.css').read()+open(cssf).read()+head[b:]
main=open(mainf).read().replace('__H__',h)
open('canvas/project/'+out,'w').write(head+main)
