# Transforme une planche .dc.html en page HTML ordinaire, pour la regarder et la contrôler en local.
# Le contenu de <x-dc> passe dans un <template> que tools/dc-stub.js remplit avec renderVals().
import re, sys, pathlib
src, out = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
s = src.read_text()
s = s.replace('<script src="./support.js"></script>', '<script src="../tools/dc-stub.js"></script>')
s = re.sub(r'<link rel="stylesheet" href="ds/[^"]+">', '<link rel="stylesheet" href="../ds/project/components/bundle.css">', s)
helmet = re.search(r'<helmet>(.*?)</helmet>', s, re.S)
s = re.sub(r'<helmet>.*?</helmet>', '', s, flags=re.S)
if helmet:
    s = s.replace('</head>', helmet.group(1) + '</head>')
s = s.replace('<x-dc>', '<template id="dc-tpl">').replace('</x-dc>', '</template><div id="dc-root"></div>')
# La logique de la planche devient un script ordinaire, lu après dc-stub.js (qui définit DCLogic).
s = re.sub(r'<script type="text/x-dc"[^>]*>', '<script>', s)
out.write_text(s)
