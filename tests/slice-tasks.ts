/**
 * Six tâches réelles sur atelier-api. Pour chacune : ce que l'agent choisirait
 * dans le sommaire, et les lignes qu'un ingénieur qui connaît le système lirait
 * avant de modifier, écrites à la main, chacune avec sa raison. La tranche doit
 * toutes les contenir, et rester courte. Aucun modèle n'est appelé.
 */
export const TASKS: { task: string; choose: string[]; must: Record<string, string> }[] = [
  {
    task: "Une réservation payée est parfois annulée.",
    choose: ["expireHolds"],
    must: {
      "src/jobs/expire.ts:12": "la tâche lit les réservations en attente",
      "src/jobs/expire.ts:18": "puis les annule",
      "src/bookings/confirm.ts:28": "le webhook confirme la même ligne",
      "src/webhooks/stripe.ts:53": "un autre écrivain de status",
      "src/bookings/update.ts:21": "un autre écrivain de status",
      "src/payments/refund.ts:27": "un autre écrivain de status",
      "src/jobs/expire.ts:13": "le constat de course",
      "src/jobs/index.ts:13": "la tâche tourne sur chaque instance",
    },
  },
  {
    task: "Rends le téléphone obligatoire à l'inscription.",
    choose: ["POST /auth/signup", "users"],
    must: {
      "src/auth/signup.ts:27": "l'écriture de users",
      "src/auth/signup.ts:19": "le corps de l'inscription part dans les journaux",
      "src/admin/export.ts:9": "l'export renvoie déjà le téléphone",
      "src/app.ts:52": "et cet export n'est gardé que par la connexion",
    },
  },
  {
    task: "Réserve l'export des clients aux administrateurs.",
    choose: ["GET /admin/export"],
    must: {
      "src/app.ts:52": "la route",
      "src/admin/export.ts:8": "la garde actuelle",
      "src/auth/session.ts:33": "la garde de rôle qui existe déjà",
      "src/db/schema.ts:15": "le rôle admin n'est jamais écrit : la route serait fermée à tous",
    },
  },
  {
    task: "Les e-mails de rappel partent en double.",
    choose: ["sendReminders"],
    must: {
      "src/jobs/reminders.ts:11": "ce que la tâche lit",
      "src/jobs/reminders.ts:17": "le message, et son identifiant",
      "src/email/worker.ts:29": "qui traite le message",
      "src/email/worker.ts:32": "ce que le traitement écrit",
      "src/jobs/index.ts:14": "la tâche tourne sur chaque instance",
    },
  },
  {
    task: "Si la mise en file de l'e-mail échoue, la réservation reste créée.",
    choose: ["POST /bookings"],
    must: {
      "src/bookings/create.ts:28": "l'écriture de la réservation",
      "src/bookings/create.ts:39": "la mise en file, hors de la transaction",
      "src/email/worker.ts:29": "qui traite le message",
    },
  },
  {
    task: "Personne n'arrive à rembourser une réservation.",
    choose: ["POST /payments/:id/refund"],
    must: {
      "src/auth/session.ts:35": "le refus si le rôle n'est pas admin",
      "src/db/schema.ts:15": "le rôle admin n'est jamais écrit",
      "src/payments/refund.ts:16": "l'appel à Stripe",
      "src/payments/refund.ts:17": "l'écriture du remboursement",
    },
  },
];
