# Inventaire : BullMQ

Pack : [vision/packs/bullmq.yaml](../../../vision/packs/bullmq.yaml). Source : la documentation de BullMQ ([files](https://docs.bullmq.io/guide/queues), [travailleurs](https://docs.bullmq.io/guide/workers), [processeurs isolés](https://docs.bullmq.io/guide/workers/sandboxed-processors), [flux](https://docs.bullmq.io/guide/flows), [tâches planifiées](https://docs.bullmq.io/guide/job-schedulers), [événements](https://docs.bullmq.io/guide/events)).

Chaque forme a un exemple dans [tests/packs-bullmq.test.ts](../../../tests/packs-bullmq.test.ts). État : **lu**, **à faire**, **hors pack**.

Une file est un canal ; mettre une tâche en file est un lien `message` vers ce canal ; un travailleur est un point d'entrée `message` que le canal déclenche.

## Déclarer une file et y mettre des tâches

| # | Forme | Exemple | État |
|---|---|---|---|
| P1 | une file nommée | `const emails = new Queue("emails", { connection })` | lu |
| P2 | mettre une tâche en file, d'un fichier qui importe la file | `emails.add("welcome", data)` | lu |
| P3 | plusieurs tâches d'un coup | `emails.addBulk([…])` | lu |
| P4 | le nom de la file dans une constante, du fichier ou importée | `new Queue(EMAIL_QUEUE)`, `import { EMAIL_QUEUE } from "./names"` | lu |
| P5 | une file importée sous un autre nom, ou par un fichier qui ré-exporte | `import { emails as mailQueue } from "./queues"` | lu |
| P6 | une tâche répétée | `emails.add("digest", data, { repeat: { pattern: "0 8 * * *" } })` | lu : la mise en file est un lien, le rythme est relevé (`job_schedule`) |
| P7 | un planificateur de tâches | `emails.upsertJobScheduler("digest", { every: 60000 }, { name: "digest" })` | lu |
| P8 | un flux parent-enfant | `new FlowProducer().add({ queueName: "orders", children: [{ queueName: "emails" }] })` : une mise en file par file nommée | lu |

## Consommer une file

| # | Forme | Exemple | État |
|---|---|---|---|
| C1 | un travailleur et son code | `new Worker("emails", sendEmail, { connection })`, code importé ou écrit sur place | lu |
| C2 | le nom de la file dans une constante | `new Worker(EMAIL_QUEUE, sendEmail)` | lu |
| C3 | un processeur isolé dans un fichier | `new Worker("emails", path.join(__dirname, "send.js"))`, `` `${__dirname}/send.js` `` : le code est ce fichier, qui fait partie du déployable | lu |

## Hors pack, ou plus tard

| Forme | Pourquoi |
|---|---|
| `new QueueEvents("emails").on("completed", …)` | un observateur des tâches, pas un consommateur : à faire, quand l'interface saura le montrer |
| le code qui répartit par nom de tâche (`switch (job.name)`) | la file suffit pour la carte ; le détail par tâche viendra avec les déroulés de features |
| une file gardée dans une propriété de classe (`this.queue.add(…)`) | à faire : le lecteur ne suit pas encore `this` |
| Bull, l'ancienne bibliothèque (`queue.process(fn)`) | une autre API : un autre pack |
| un nom de file calculé à l'exécution | doit apparaître comme non lu |
