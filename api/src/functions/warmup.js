/**
 * warmup.js — Timer trigger: keeps Function App warm during conference hours
 *
 * Fires every 10 minutes during conference hours (Oct 5–7, 2026):
 *   Conference: Mon Oct 5 – Wed Oct 7
 *   Hours: 6:00 AM – 6:00 PM CT = 11:00 – 23:00 UTC
 *   CRON: "0 * /10 11-22 5-7 10 *"  (interval: every 10 min)
 *
 * Touches the Cosmos DB connection to keep it warm (prevents cold-start
 * latency on the first real request of each session).
 *
 * Note: This timer ONLY fires during the 3-day conference window.
 * It does nothing outside that range — the CRON expression handles scoping.
 */

import { app } from '@azure/functions';
import { getAllSponsors } from '../lib/cosmos.js';

app.timer('warmup', {
  // Every 10 minutes, 11:00–22:59 UTC, Oct 5–7 only
  schedule: '0 */10 11-22 5-7 10 *',
  runOnStartup: false,
  handler: async (myTimer, context) => {
    try {
      const sponsors = await getAllSponsors();
      context.log(`[warmup] OK — ${sponsors.length} sponsors in Cosmos. ${new Date().toISOString()}`);
    } catch (err) {
      context.log.error('[warmup] Cosmos ping failed:', err.message);
    }
  },
});
