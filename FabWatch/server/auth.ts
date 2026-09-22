import type { Express, Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { storage, verifyPassword } from "./storage";
import { log } from "./index";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-10-28" })
  : null;

const PRICE_IDS: Record<string, string> = {
  monitor: process.env.STRIPE_PRICE_MONITOR ?? "",
  pro:     process.env.STRIPE_PRICE_PRO     ?? "",
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
  next();
}

export function requireTier(minTier: "free" | "monitor" | "pro") {
  const TIER_RANK: Record<string, number> = { free: 0, monitor: 1, pro: 2 };
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Authentication required" });
    const userTier = req.session.userTier ?? "free";
    if (TIER_RANK[userTier] < TIER_RANK[minTier]) {
      return res.status(403).json({ error: "Subscription required", required: minTier, current: userTier, upgradeUrl: "/#/pricing" });
    }
    next();
  };
}

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (storage.getUserByEmail(email)) return res.status(409).json({ error: "Email already registered" });
      const user = storage.createUser(email, password);
      req.session.userId = user.id;
      req.session.userTier = user.tier;
      log(`registered: ${email}`, "auth");
      res.status(201).json({ user });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });
      const user = storage.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.passwordHash)) return res.status(401).json({ error: "Invalid credentials" });
      storage.updateUserLastLogin(user.id);
      req.session.userId = user.id;
      req.session.userTier = user.tier;
      const { passwordHash: _, ...safeUser } = user;
      log(`login: ${email} (${user.tier})`, "auth");
      res.json({ user: safeUser });
    } catch (e) { res.status(500).json({ error: String(e) }); }
  });

  app.post("/api/auth/logout", (req, res) => { req.session.destroy(() => res.json({ ok: true })); });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user });
  });

  app.post("/api/subscribe", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const { tier } = req.body;
    const priceId = PRICE_IDS[tier];
    if (!priceId) return res.status(400).json({ error: "Invalid tier" });
    const user = storage.getUserById(req.session.userId!);
    if (!user) return res.status(404).json({ error: "User not found" });
    try {
      let customerId = storage.getUserByEmail(user.email)?.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: user.email, metadata: { fabwatchUserId: String(user.id) } });
        customerId = customer.id;
        storage.updateUserStripe(user.id, { stripeCustomerId: customerId });
      }
      const session = await stripe.checkout.sessions.create({
        customer: customerId, mode: "subscription", payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/?subscribed=1`,
        cancel_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/pricing`,
        subscription_data: { trial_period_days: 7, metadata: { fabwatchUserId: String(user.id), tier } },
      });
      res.json({ url: session.url });
    } catch (e: any) { log(`Stripe error: ${e.message}`, "auth"); res.status(500).json({ error: e.message }); }
  });

  app.post("/api/stripe/webhook", (req, res, next) => next(), async (req, res) => {
    if (!stripe) return res.status(503).end();
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET ?? "");
    } catch (e: any) { return res.status(400).send(`Webhook error: ${e.message}`); }
    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = parseInt(sub.metadata?.fabwatchUserId ?? "0");
          if (userId) {
            const newTier = sub.status === "active" || sub.status === "trialing" ? (sub.metadata?.tier ?? "monitor") : "free";
            storage.updateUserStripe(userId, { stripeSubscriptionId: sub.id, stripeSubscriptionStatus: sub.status, tier: newTier });
            log(`subscription ${sub.status}: user ${userId} → ${newTier}`, "stripe");
          }
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const userId = parseInt(sub.metadata?.fabwatchUserId ?? "0");
          if (userId) { storage.updateUserStripe(userId, { stripeSubscriptionStatus: "canceled", tier: "free" }); log(`canceled: user ${userId} → free`, "stripe"); }
          break;
        }
      }
      res.json({ received: true });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/manage-subscription", requireAuth, async (req, res) => {
    if (!stripe) return res.status(503).json({ error: "Stripe not configured" });
    const userFull = storage.getUserByEmail(storage.getUserById(req.session.userId!)?.email ?? "");
    if (!userFull?.stripeCustomerId) return res.status(400).json({ error: "No active subscription" });
    const session = await stripe.billingPortal.sessions.create({ customer: userFull.stripeCustomerId, return_url: `${process.env.APP_URL ?? "http://localhost:5000"}/#/` });
    res.json({ url: session.url });
  });
}
