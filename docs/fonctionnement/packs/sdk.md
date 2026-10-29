# Inventaire : SDK de services externes (Stripe, Resend, nodemailer)

Pack : [vision/packs/sdk.yaml](../../../vision/packs/sdk.yaml). Sources : la documentation de [stripe-node](https://github.com/stripe/stripe-node) et des [webhooks Stripe](https://docs.stripe.com/webhooks), de [Resend pour Node.js](https://resend.com/docs/send-with-nodejs) et de [nodemailer](https://nodemailer.com/usage/).

Chaque forme a un exemple dans [tests/packs-sdk.test.ts](../../../tests/packs-sdk.test.ts). État : **lu**, **à faire**, **hors pack**.

Un service externe est un nœud de la carte. Créer son client et l'appeler sont des liens `request` du déployable vers ce service ; vérifier la signature d'un webhook dit que c'est ce service qui appelle la route.

## Créer le client

| # | Forme | Exemple | État |
|---|---|---|---|
| K1 | Stripe, avec `new` | `import Stripe from "stripe"; const stripe = new Stripe(key, { apiVersion })` | lu |
| K2 | Stripe, en appelant le module | `const stripe = require("stripe")(key)`, `import Stripe from "stripe"; const stripe = Stripe(key)` | lu |
| K3 | Resend | `import { Resend } from "resend"; const resend = new Resend(key)` | lu |
| K4 | nodemailer, un transport | `nodemailer.createTransport({ host, port })`, `import { createTransport } from "nodemailer"` | lu |

## Appeler le service

| # | Forme | Exemple | État |
|---|---|---|---|
| A1 | Stripe, une ressource | `stripe.customers.create(…)`, `stripe.checkout.sessions.create(…)` | lu |
| A2 | Resend, envoyer | `resend.emails.send({ from, to, subject })`, `resend.batch.send([…])` | lu |
| A3 | nodemailer, envoyer | `transporter.sendMail({ from, to, subject })` | lu |

## Recevoir un webhook

| # | Forme | Exemple | État |
|---|---|---|---|
| W1 | Stripe, vérifier la signature | `stripe.webhooks.constructEvent(body, sig, secret)`, `constructEventAsync` : un appel entrant de Stripe vers la route dont c'est le code ; ce n'est pas une requête vers Stripe | lu |

## Où vit le client

Ces formes viennent du langage, pas des SDK ; elles valent pour les trois.

| # | Forme | Exemple | État |
|---|---|---|---|
| L1 | dans le fichier, au premier niveau ou dans une fonction | `const stripe = new Stripe(k)` puis `stripe.refunds.create()` | lu |
| L2 | importé d'un autre fichier, sous un autre nom, ou par un fichier qui ré-exporte | `import { stripe as billing } from "./clients"` | lu |
| L3 | exporté par défaut | `export default new Resend(k)`, `import resend from "./resend"` | lu |
| L4 | rendu par une fonction, créé tout de suite ou au premier appel | `export function getStripe() { if (!s) s = new Stripe(k); return s; }` puis `getStripe().customers.list()`, ou `const s = getStripe(); s.customers.list()` | lu |
| L5 | gardé dans une propriété de classe | `this.client = new Resend(k)` puis `this.client.emails.send()` | à faire : la création est lue, pas les appels ; le lecteur ne suit pas encore `this` |

## Ce que le pack ne prend pas pour un appel

| Forme | Pourquoi |
|---|---|
| `stripe.webhooks.constructEvent(…)` | une vérification faite sur place (W1), pas une requête vers Stripe |
| `new Stripe.errors.StripeError()`, une classe d'un paquet qui n'est pas un service | seuls les clients des services listés comptent |
| `express()`, `cors()` : un module appelé comme une fonction | ce n'est un client que pour les SDK qui se créent ainsi (Stripe) |

## Hors pack

| Forme | Pourquoi |
|---|---|
| `new Webhook(secret).verify(payload, headers)` (Svix) | la signature est vérifiée, mais le code ne dit pas quel service envoie : Svix sert plusieurs services ; à montrer comme appel entrant d'un émetteur inconnu quand l'interface le saura |
| OpenAI, Anthropic | même forme que K1 (`new OpenAI()`, `new Anthropic()`) donc lus, mais leur API n'est pas encore inventoriée |
| Twilio, SendGrid | d'autres API (`twilio(sid, token)`, `sgMail.send()`) : pas encore inventoriées, retirées du pack |
| la machine SMTP derrière nodemailer (`host`) | souvent une variable d'environnement : le service s'appelle « Serveur SMTP » |
