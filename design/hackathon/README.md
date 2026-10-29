# Écrans du hackathon

Copie des planches publiées sur le canevas « VisionLayer, écrans du hackathon » (https://claude.ai/artifact/5gsV2UuZTsv3QRHu6tyHbd).

- `planches/` : les planches `.dc.html` et `canvas.json`, telles que publiées.
- `sources/` : de quoi les reconstruire.
  - `build.py` assemble une planche à partir de la coque d'une planche existante, d'une feuille de style et d'un `main-*.html`.
  - `gen.py` remplace `__ROBOT:humeur:taille:d|l__` par Bolt, dessiné par `../vigie/robot.py`.

Pour contrôler une planche avant de la montrer, voir `../outils/README.md`.
