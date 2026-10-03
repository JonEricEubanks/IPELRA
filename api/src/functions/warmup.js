/**
 * warmup.js — Timer trigger: keeps Function App warm during conference hours
 *
 * Fires every 10 minutes, 6:00 AM – 10:59 PM CT, Sun Oct 4 – Wed Oct 7, 2026
 * (covers Sunday registration and the evening events):
 *   11:00–23:59 UTC = 6 AM–6:59 PM CT; 00:00–03:59 UTC = 7–10:59 PM CT (previous day)
 *   CRON: "0 * /10 0-3,11-23 4-8 10 *"  (interval: every 10 min)
 *
 * Touches the Cosmos DB connection to keep it warm (prevents cold-start
 * latency on the first real request of each session).
 *
 * Note: This timer ONLY fires during the conference window above.
 * It does nothing outside that range — the CRON expression handles scoping.
 */

import { app } from '@azure/functions';
import { getAllSponsors } from '../lib/cosmos.js';

app.timer('warmup', {
  // Every 10 minutes, 6 AM–10:59 PM CT, Sun Oct 4 – Wed Oct 7
  schedule: '0 */10 0-3,11-23 4-8 10 *',
  runOnStartup: false,
  handler: async (myTimer, context) => {
    try {
      const sponsors = await getAllSponsors();
      context.log(`[warmup] OK — ${sponsors.length} sponsors in Cosmos. ${new Date().toISOString()}`);
    } catch (err) {
      context.error('[warmup] Cosmos ping failed:', err.message);
    }
  },
});
