import cookieParser from "cookie-parser";
import express from "express";
import { exportUsers } from "./admin/export";
import { login } from "./auth/login";
import { requestReset } from "./auth/reset";
import { signup } from "./auth/signup";
import { cancelBooking } from "./bookings/update";
import { createBooking } from "./bookings/create";
import { getBooking } from "./bookings/get";
import { transferBooking } from "./bookings/transfer";
import { env } from "./env";
import { health } from "./health";
import { errorHandler, route } from "./http";
import { createPayment } from "./payments/create";
import { refundPayment } from "./payments/refund";
import { createReview } from "./reviews/create";
import { stripeWebhook } from "./webhooks/stripe";
import { getWorkshop } from "./workshops/get";
import { listWorkshops } from "./workshops/list";

export const app = express();

app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", env.WEB_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  next();
});

// express.json() casserait la signature : cette route lit le corps brut
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), route(stripeWebhook));

app.use(express.json());
app.use(cookieParser(env.SESSION_SECRET));

app.post("/auth/signup", route(signup));
app.post("/auth/login", route(login));
app.post("/auth/reset", route(requestReset));

app.get("/workshops", route(listWorkshops));
app.get("/workshops/:id", route(getWorkshop));

app.post("/bookings", route(createBooking));
app.get("/bookings/:id", route(getBooking));
app.patch("/bookings/:id", route(cancelBooking));
app.post("/bookings/:id/transfer", route(transferBooking));

app.post("/payments", route(createPayment));
app.post("/payments/:id/refund", route(refundPayment));

app.post("/reviews", route(createReview));
app.get("/admin/export", route(exportUsers));
app.get("/healthz", route(health));

app.use(errorHandler);
