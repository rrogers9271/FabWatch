import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  broker: text("broker").notNull(), // ATREG, Moov, LA Semiconductor, CBRE, etc.
  status: text("status").notNull().default("active"), // active | under_contract | sold | watch
  type: text("type").notNull(), // fab | cleanroom | polysilicon | epitaxy | compound_semi | r_and_d
  waferSizes: text("wafer_sizes").notNull().default("[]"), // JSON array: ["150mm","200mm"]
  squareFootage: integer("square_footage"),
  powerCapacityMW: real("power_capacity_mw"),
  state: text("state").notNull(),
  city: text("city").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  askingPrice: text("asking_price"), // free text e.g. "~$45M" or "Undisclosed"
  nodes: text("nodes").notNull().default("[]"), // JSON array of process nodes e.g. ["150mm BiCMOS","MEMS"]
  seller: text("seller"),
  listedDate: text("listed_date"),
  notes: text("notes"),
  sourceUrl: text("source_url"),
});

export const expansions = sqliteTable("expansions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  company: text("company").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  type: text("type").notNull(), // logic | sic | memory | compound_semi | advanced_packaging | polysilicon
  investmentBillions: real("investment_billions"),
  waferSize: text("wafer_size"), // e.g. "300mm"
  completionYear: integer("completion_year"),
  status: text("status").notNull().default("planned"), // planned | under_construction | operational
  notes: text("notes"),
  sourceUrl: text("source_url"),
});

export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  minSqft: integer("min_sqft"),
  maxSqft: integer("max_sqft"),
  waferSize: text("wafer_size"), // filter by specific wafer size or null for any
  types: text("types").notNull().default("[]"), // JSON array of facility types
  states: text("states").notNull().default("[]"), // JSON array of state codes
  minPowerMW: real("min_power_mw"),
  active: integer("active").notNull().default(1),
  createdAt: text("created_at").notNull().default(""),
});

export const insertListingSchema = createInsertSchema(listings).omit({ id: true });
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;

export const insertExpansionSchema = createInsertSchema(expansions).omit({ id: true });
export type InsertExpansion = z.infer<typeof insertExpansionSchema>;
export type Expansion = typeof expansions.$inferSelect;

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({ id: true });
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AlertRule = typeof alertRules.$inferSelect;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tier: text("tier").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeSubscriptionStatus: text("stripe_subscription_status"),
  trialEndsAt: text("trial_ends_at"),
  createdAt: text("created_at").notNull().default(""),
  lastLoginAt: text("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">;

export const equipment = sqliteTable("equipment", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  waferSize: text("wafer_size"),
  vintage: text("vintage"),
  condition: text("condition"),
  quantity: integer("quantity").notNull().default(1),
  askingPrice: text("asking_price"),
  location: text("location"),
  state: text("state"),
  seller: text("seller"),
  broker: text("broker"),
  auctionDate: text("auction_date"),
  status: text("status").notNull().default("available"),
  notes: text("notes"),
  sourceUrl: text("source_url"),
  listedDate: text("listed_date"),
});

export const insertEquipmentSchema = createInsertSchema(equipment).omit({ id: true });
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;
export type Equipment = typeof equipment.$inferSelect;
