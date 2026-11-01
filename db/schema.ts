import {
  bigint,
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const userId = () => bigint("userId", { mode: "number", unsigned: true }).notNull();
const market = () => mysqlEnum("market", ["spot", "futures"]).notNull();
const money = (name: string) => decimal(name, { precision: 38, scale: 18 }).notNull();

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  passwordResetTokenHash: varchar("passwordResetTokenHash", { length: 64 }),
  passwordResetExpiresAt: timestamp("passwordResetExpiresAt"),
  sessionVersion: int("sessionVersion").default(0).notNull(),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export const botSettings = mysqlTable(
  "bot_settings",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull().default("15m"),
    riskPct: decimal("riskPct", { precision: 6, scale: 3 }).notNull().default("0.500"),
    maxPositionUsd: decimal("maxPositionUsd", { precision: 14, scale: 2 }).notNull().default("250.00"),
    maxDailyLossUsd: decimal("maxDailyLossUsd", { precision: 14, scale: 2 }).notNull().default("25.00"),
    leverage: int("leverage").notNull().default(2),
    liveEnabled: boolean("liveEnabled").notNull().default(false),
    lastRunAt: timestamp("lastRunAt"),
    lastValidationAt: timestamp("lastValidationAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("bot_settings_user_market").on(table.userId, table.market)],
);

export const apiCredentials = mysqlTable(
  "api_credentials",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    encryptedKey: text("encryptedKey").notNull(),
    encryptedSecret: text("encryptedSecret").notNull(),
    encryptedPassphrase: text("encryptedPassphrase").notNull(),
    keyVersion: varchar("keyVersion", { length: 8 }).notNull().default("3"),
    keyHint: varchar("keyHint", { length: 16 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("api_credentials_user_market").on(table.userId, table.market)],
);

export const positions = mysqlTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    side: mysqlEnum("side", ["buy", "sell"]).notNull(),
    strategyId: varchar("strategyId", { length: 64 }).notNull(),
    quantity: money("quantity"),
    entryPrice: money("entryPrice"),
    stopPrice: money("stopPrice"),
    targetPrice: money("targetPrice"),
    status: mysqlEnum("status", ["pending", "open", "closing", "closed", "error"]).notNull().default("pending"),
    realizedPnl: decimal("realizedPnl", { precision: 38, scale: 18 }),
    exchangeOrderId: varchar("exchangeOrderId", { length: 96 }),
    clientOid: varchar("clientOid", { length: 96 }).notNull().unique(),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
  },
  (table) => [index("positions_user_status").on(table.userId, table.status)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    positionId: bigint("positionId", { mode: "number", unsigned: true }).references(() => positions.id),
    market: market(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    side: mysqlEnum("side", ["buy", "sell"]).notNull(),
    purpose: mysqlEnum("purpose", ["entry", "exit", "test"]).notNull(),
    strategyId: varchar("strategyId", { length: 64 }).notNull(),
    clientOid: varchar("clientOid", { length: 96 }).notNull().unique(),
    exchangeOrderId: varchar("exchangeOrderId", { length: 96 }),
    orderType: varchar("orderType", { length: 16 }).notNull().default("market"),
    quantity: decimal("quantity", { precision: 38, scale: 18 }),
    funds: decimal("funds", { precision: 38, scale: 18 }),
    price: decimal("price", { precision: 38, scale: 18 }),
    status: mysqlEnum("status", ["accepted", "rejected", "filled", "cancelled", "error"]).notNull(),
    responseText: text("responseText"),
    signalTime: timestamp("signalTime"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("orders_user_created").on(table.userId, table.createdAt)],
);

export const validationRuns = mysqlTable(
  "validation_runs",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    strategyId: varchar("strategyId", { length: 64 }).notNull(),
    eligible: boolean("eligible").notNull().default(false),
    reason: varchar("reason", { length: 500 }).notNull(),
    netR: decimal("netR", { precision: 18, scale: 6 }).notNull().default("0"),
    closedTrades: int("closedTrades").notNull().default(0),
    winRate: decimal("winRate", { precision: 8, scale: 4 }).notNull().default("0"),
    profitFactor: decimal("profitFactor", { precision: 18, scale: 6 }),
    folds: json("folds").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("validation_user_market_created").on(table.userId, table.market, table.createdAt)],
);

export const coinRankings = mysqlTable(
  "coin_rankings",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    rank: int("rank").notNull(),
    score: decimal("score", { precision: 18, scale: 6 }).notNull(),
    momentum7dPct: decimal("momentum7dPct", { precision: 18, scale: 6 }).notNull(),
    momentum30dPct: decimal("momentum30dPct", { precision: 18, scale: 6 }).notNull(),
    relativeStrength7dPct: decimal("relativeStrength7dPct", { precision: 18, scale: 6 }).notNull(),
    dailyVolatilityPct: decimal("dailyVolatilityPct", { precision: 18, scale: 6 }).notNull(),
    averageDollarVolume: decimal("averageDollarVolume", { precision: 24, scale: 6 }).notNull(),
    regime: varchar("regime", { length: 16 }).notNull(),
    liquid: boolean("liquid").notNull().default(false),
    reason: varchar("reason", { length: 500 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("coin_rankings_user_market_created").on(table.userId, table.market, table.createdAt)],
);

export const botEvents = mysqlTable(
  "bot_events",
  {
    id: serial("id").primaryKey(),
    userId: userId().references(() => users.id),
    market: market(),
    level: mysqlEnum("level", ["info", "warn", "error", "success"]).notNull().default("info"),
    message: text("message").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("events_user_created").on(table.userId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BotSettings = typeof botSettings.$inferSelect;
export type ApiCredentials = typeof apiCredentials.$inferSelect;
export type Position = typeof positions.$inferSelect;
export type ValidationRun = typeof validationRuns.$inferSelect;
