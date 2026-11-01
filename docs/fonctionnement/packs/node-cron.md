# Inventaire : node-cron

Pack : [vision/packs/node-cron.yaml](../../../vision/packs/node-cron.yaml). Source : la documentation de node-cron ([README](https://github.com/node-cron/node-cron), [planifier](https://nodecron.com/scheduling-tasks.html), [tâches en arrière-plan](https://nodecron.com/background-tasks.html)), versions 3 et 4.

Chaque forme a un exemple dans [tests/packs-node-cron.test.ts](../../../tests/packs-node-cron.test.ts). État : **lu**, **à faire**, **hors pack**.

Une tâche planifiée est un point d'entrée `schedule` : sa clé est l'expression cron, son code est la fonction appelée à chaque échéance.

## Planifier une tâche

| # | Forme | Exemple | État |
|---|---|---|---|
| T1 | planifier, avec l'import par défaut | `import cron from "node-cron"; cron.schedule("0 8 * * *", fn)` | lu |
| T2 | le module importé autrement | `import * as cron from "node-cron"`, `const cron = require("node-cron")` | lu |
| T3 | la fonction importée seule | `import { schedule } from "node-cron"; schedule("0 8 * * *", fn)` | lu |
| T4 | créer la tâche sans la démarrer (version 4) | `const task = cron.createTask("0 8 * * *", fn); task.start()` | lu |
| T5 | l'expression dans une constante, du fichier ou importée | `cron.schedule(DAILY, fn)`, `import { DAILY } from "./schedules"` | lu |
| T6 | une tâche en arrière-plan (version 4) : un fichier lancé dans un autre processus | `cron.schedule("0 3 * * *", "./tasks/backup.js")`, `path.join(__dirname, "tasks/backup.js")` : le code est ce fichier, qui fait partie du déployable | lu |
| T7 | les options | `{ timezone: "Europe/Paris", name: "reminders", noOverlap: true }` | à faire : le fuseau est relevé (`cron_option`), l'interface ne le montre pas encore |

## Le code de la tâche

Ces formes viennent du langage, pas de node-cron ; le lecteur générique les suit pour toutes les piles.

| # | Forme | Exemple | État |
|---|---|---|---|
| H1 | une fonction importée | `cron.schedule(e, sendReminders)` | lu |
| H2 | une fonction écrite sur place | `cron.schedule(e, async () => { … })` | lu : le code est à la ligne de la fonction |
| H3 | une méthode d'un objet importé | `cron.schedule(e, jobs.purge)` | lu |
| H4 | une fonction passée à une enveloppe | `cron.schedule(e, safe(sendReminders))`, `safe("nom", sendReminders)` : le code est le dernier argument | lu |

## Ce que le pack ne prend pas pour une tâche

| Forme | Pourquoi |
|---|---|
| `cron.validate("0 8 * * *")`, `cron.getTasks()` | vérifier ou lister n'est pas planifier |
| un `schedule(…)` d'un autre module | seul ce qui vient de `node-cron` compte |

## Hors pack

| Forme | Pourquoi |
|---|---|
| `new CronJob(e, fn)` du paquet `cron` | une autre bibliothèque, une autre API : un autre pack |
| une expression calculée à l'exécution | doit apparaître comme non lue |
