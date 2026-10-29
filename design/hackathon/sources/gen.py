# gen.py <main> <sortie> : remplace __ROBOT:humeur:taille:dark__ par le dessin de Bolt
import sys,re; sys.path.insert(0,'robot'); import robot as r
s=open(sys.argv[1]).read()
def rep(m):
    mood,size,dark=m.group(1),int(m.group(2)),m.group(3)=='d'
    return r.bolt(mood,wave=(mood=='accueil'),size=size,dark=dark)
s=re.sub(r'__ROBOT:(\w+):(\d+):(\w)__',rep,s)
open(sys.argv[2],'w').write(s)
