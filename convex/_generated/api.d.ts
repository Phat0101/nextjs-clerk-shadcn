/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as chat from "../chat.js";
import type * as embeddings from "../embeddings.js";
import type * as inbox from "../inbox.js";
import type * as jobs from "../jobs.js";
import type * as myFunctions from "../myFunctions.js";
import type * as priceUnits from "../priceUnits.js";
import type * as seedData from "../seedData.js";
import type * as systemSettings from "../systemSettings.js";
import type * as templates from "../templates.js";
import type * as upload from "../upload.js";
import type * as users from "../users.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  embeddings: typeof embeddings;
  inbox: typeof inbox;
  jobs: typeof jobs;
  myFunctions: typeof myFunctions;
  priceUnits: typeof priceUnits;
  seedData: typeof seedData;
  systemSettings: typeof systemSettings;
  templates: typeof templates;
  upload: typeof upload;
  users: typeof users;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
