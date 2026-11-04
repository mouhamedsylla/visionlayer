# Examples

`pnpm start --examples` clones these public projects at a pinned commit into `~/.visionlayer/examples` and lists them. Their code is not in this repository.

| Project | Why | License |
|---|---|---|
| `tests/corpus/atelier-api` | Our own test bed: booking, Stripe, a queue, scheduled jobs. The engine was tuned on it. | Apache 2.0 |
| [Barbershop-Booking-System](https://github.com/MrTabaOfficial/Barbershop-Booking-System) | Never seen before reading: booking with a payment flow and scheduled jobs | MIT |
| [lingua-crm](https://github.com/sergei-cmyk-web/lingua-crm) | Never seen before reading: 125 entry points, 3 queues | MIT |
| [mini-erp-crm](https://github.com/Rahul03ll/mini-erp-crm) | Never seen before reading; carries one real agent session and its Replay | MIT |

`mini-erp-crm/.vision` holds what that session left: the session record, the note it declared, and Replay `r-001` (the agent's patch, derived from the MIT-licensed project, and its test). The patch is applied after the clone.
