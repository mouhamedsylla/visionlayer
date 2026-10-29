# Dessins de Vigie : trois robots, et les humeurs du premier.
INK="#121211"; LIGHT="#f5f4f1"; GREY="#c8c5bf"; SCREEN="#141413"; ORANGE="#e2791d"; GREEN="#2c9a57"

def face(mood, cx=80, cy=68, dx=16):
    """Yeux et bouche sur l'écran, selon l'humeur."""
    L, R = cx-dx, cx+dx
    eye = lambda x: f'<ellipse cx="{x}" cy="{cy-2}" rx="7" ry="9" fill="{LIGHT}"/><circle cx="{x+2.5}" cy="{cy-5}" r="2.2" fill="{SCREEN}"/>'
    if mood == "accueil":
        e = eye(L)+eye(R); m = f'<path d="M{cx-9} {cy+12} q9 8 18 0" stroke="{LIGHT}" stroke-width="3" fill="none" stroke-linecap="round"/>'
    elif mood == "reflechit":
        e = f'<ellipse cx="{L}" cy="{cy-2}" rx="7" ry="9" fill="{LIGHT}"/><circle cx="{L+3}" cy="{cy-7}" r="2.2" fill="{SCREEN}"/><ellipse cx="{R}" cy="{cy-2}" rx="7" ry="9" fill="{LIGHT}"/><circle cx="{R+3}" cy="{cy-7}" r="2.2" fill="{SCREEN}"/>'
        m = f'<path d="M{cx-7} {cy+14} h14" stroke="{LIGHT}" stroke-width="3" stroke-linecap="round"/>'
    elif mood == "questionne":
        e = eye(L)+f'<ellipse cx="{R}" cy="{cy-1}" rx="7" ry="6" fill="{LIGHT}"/><circle cx="{R+2}" cy="{cy-2}" r="2" fill="{SCREEN}"/><path d="M{R-8} {cy-14} l14 -4" stroke="{LIGHT}" stroke-width="3" stroke-linecap="round"/>'
        m = f'<circle cx="{cx+2}" cy="{cy+14}" r="3.5" fill="none" stroke="{LIGHT}" stroke-width="2.5"/>'
    elif mood == "concentre":
        e = f'<path d="M{L-7} {cy-1} h14 M{R-7} {cy-1} h14" stroke="{LIGHT}" stroke-width="4" stroke-linecap="round"/>'
        m = f'<path d="M{cx-6} {cy+13} h12" stroke="{LIGHT}" stroke-width="3" stroke-linecap="round"/>'
    elif mood == "epate":
        e = f'<circle cx="{L}" cy="{cy-2}" r="9" fill="{LIGHT}"/><circle cx="{L}" cy="{cy-2}" r="3.5" fill="{SCREEN}"/><circle cx="{R}" cy="{cy-2}" r="9" fill="{LIGHT}"/><circle cx="{R}" cy="{cy-2}" r="3.5" fill="{SCREEN}"/>'
        m = f'<ellipse cx="{cx}" cy="{cy+15}" rx="5" ry="6" fill="{LIGHT}"/>'
    else:  # content
        e = f'<path d="M{L-7} {cy} q7 -9 14 0 M{R-7} {cy} q7 -9 14 0" stroke="{LIGHT}" stroke-width="3.5" fill="none" stroke-linecap="round"/>'
        m = f'<path d="M{cx-11} {cy+10} q11 12 22 0" stroke="{LIGHT}" stroke-width="3" fill="none" stroke-linecap="round"/>'
    return e + m

def bolt(mood="accueil", wave=True, size=160, dark=False):
    """A : tête-écran, antenne, petit corps, un bras qui salue."""
    arm_r = f'<path d="M116 126 q16 -6 20 -26" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="137" cy="97" r="7" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/>' if wave else f'<path d="M116 126 q14 6 16 20" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="133" cy="149" r="7" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/>'
    svg = f'''<svg width="{size}" height="{size*1.15:.0f}" viewBox="0 0 160 184" aria-hidden="true">
<ellipse cx="80" cy="178" rx="34" ry="5" fill="{INK}" opacity=".12"/>
<path d="M80 30V15" stroke="{INK}" stroke-width="4" stroke-linecap="round"/><circle cx="80" cy="11" r="7" fill="{ORANGE}" stroke="{INK}" stroke-width="3"/>
<rect x="18" y="54" width="14" height="28" rx="6" fill="{GREY}" stroke="{INK}" stroke-width="3"/><rect x="128" y="54" width="14" height="28" rx="6" fill="{GREY}" stroke="{INK}" stroke-width="3"/>
<rect x="30" y="28" width="100" height="80" rx="24" fill="{LIGHT}" stroke="{INK}" stroke-width="3.5"/>
<rect x="42" y="40" width="76" height="56" rx="16" fill="{SCREEN}"/>
{face(mood)}
<circle cx="52" cy="84" r="4" fill="{ORANGE}" opacity=".85"/><circle cx="108" cy="84" r="4" fill="{ORANGE}" opacity=".85"/>
<rect x="68" y="107" width="24" height="9" rx="3" fill="{GREY}" stroke="{INK}" stroke-width="3"/>
<path d="M44 126 q-14 6 -16 20" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="27" cy="149" r="7" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/>
{arm_r}
<rect x="44" y="114" width="72" height="52" rx="20" fill="{LIGHT}" stroke="{INK}" stroke-width="3.5"/>
<circle cx="80" cy="138" r="7" fill="{GREEN}" stroke="{INK}" stroke-width="2.5"/>
<rect x="54" y="164" width="18" height="10" rx="5" fill="{INK}"/><rect x="88" y="164" width="18" height="10" rx="5" fill="{INK}"/>
</svg>'''
    if dark:
        svg = svg.replace('stroke="#121211"', 'stroke="#f5f4f1"').replace('fill="#f5f4f1" stroke', 'fill="#2a2a27" stroke').replace('<rect x="54" y="164" width="18" height="10" rx="5" fill="#121211"/><rect x="88" y="164" width="18" height="10" rx="5" fill="#121211"/>', '<rect x="54" y="164" width="18" height="10" rx="5" fill="#f5f4f1"/><rect x="88" y="164" width="18" height="10" rx="5" fill="#f5f4f1"/>').replace('fill="#121211" opacity=".12"', 'fill="#000" opacity=".4"')
    return svg

def pebble(size=160):
    """B : un galet rond, une visière, des mains qui flottent."""
    return f'''<svg width="{size}" height="{size*1.15:.0f}" viewBox="0 0 160 184" aria-hidden="true">
<ellipse cx="80" cy="176" rx="30" ry="5" fill="{INK}" opacity=".12"/>
<path d="M80 34 q-6 -14 4 -22" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="86" cy="11" r="6" fill="{ORANGE}" stroke="{INK}" stroke-width="3"/>
<path d="M80 30 C126 30 140 70 138 104 C136 144 112 162 80 162 C48 162 24 144 22 104 C20 70 34 30 80 30Z" fill="{LIGHT}" stroke="{INK}" stroke-width="3.5"/>
<rect x="38" y="62" width="84" height="42" rx="21" fill="{SCREEN}"/>
<ellipse cx="64" cy="83" rx="8" ry="10" fill="{LIGHT}"/><ellipse cx="96" cy="83" rx="8" ry="10" fill="{LIGHT}"/>
<circle cx="66" cy="79" r="2.5" fill="{SCREEN}"/><circle cx="98" cy="79" r="2.5" fill="{SCREEN}"/>
<path d="M70 124 q10 8 20 0" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
<circle cx="50" cy="116" r="5" fill="{ORANGE}" opacity=".8"/><circle cx="110" cy="116" r="5" fill="{ORANGE}" opacity=".8"/>
<circle cx="12" cy="118" r="9" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/><circle cx="150" cy="96" r="9" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/>
</svg>'''

def lookout(size=160):
    """C : la vigie, un œil-lentille au bout d'un périscope, sur chenilles."""
    return f'''<svg width="{size}" height="{size*1.15:.0f}" viewBox="0 0 160 184" aria-hidden="true">
<ellipse cx="80" cy="178" rx="40" ry="5" fill="{INK}" opacity=".12"/>
<rect x="72" y="58" width="16" height="40" rx="4" fill="{GREY}" stroke="{INK}" stroke-width="3"/>
<rect x="34" y="14" width="92" height="52" rx="26" fill="{LIGHT}" stroke="{INK}" stroke-width="3.5"/>
<circle cx="64" cy="40" r="16" fill="{SCREEN}"/><circle cx="64" cy="40" r="7" fill="{LIGHT}"/><circle cx="67" cy="37" r="2.5" fill="{SCREEN}"/>
<circle cx="100" cy="40" r="10" fill="{SCREEN}"/><circle cx="100" cy="40" r="4" fill="{ORANGE}"/>
<rect x="40" y="94" width="80" height="54" rx="14" fill="{LIGHT}" stroke="{INK}" stroke-width="3.5"/>
<path d="M60 116 q20 12 40 0" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M40 112 h-14 v-14" stroke="{INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="94" r="6" fill="{LIGHT}" stroke="{INK}" stroke-width="3"/>
<rect x="30" y="146" width="100" height="26" rx="13" fill="{INK}"/>
<circle cx="46" cy="159" r="6" fill="{GREY}"/><circle cx="68" cy="159" r="6" fill="{GREY}"/><circle cx="92" cy="159" r="6" fill="{GREY}"/><circle cx="114" cy="159" r="6" fill="{GREY}"/>
</svg>'''
