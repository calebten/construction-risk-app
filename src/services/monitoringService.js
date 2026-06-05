/**
 * Autonomous Monitoring Service
 *
 * Wakes up every morning at 6am and proactively checks every registered job
 * site for that day's concrete pour risk — with no human trigger needed.
 * Sends Slack alerts and logs results to Google Sheets automatically.
 *
 * This is what makes the app "agentic": it acts on its own schedule.
 */

const { runRiskAgent } = require('./agentService');
const registry = require('./jobSiteRegistry');

// Coordinates lookup for Georgia cities (extend as needed)
const GEORGIA_COORDS = {
  'Atlanta':      { lat: 33.7490, lon: -84.3880 },
  'Athens':       { lat: 33.9519, lon: -83.3576 },
  'Augusta':      { lat: 33.4735, lon: -82.0105 },
  'Columbus':     { lat: 32.4609, lon: -84.9877 },
  'Macon':        { lat: 32.8407, lon: -83.6324 },
  'Savannah':     { lat: 32.0809, lon: -81.0912 },
  'Marietta':     { lat: 33.9526, lon: -84.5499 },
  'Alpharetta':   { lat: 34.0754, lon: -84.2941 },
  'Kennesaw':     { lat: 34.0234, lon: -84.6155 },
  'Roswell':      { lat: 34.0234, lon: -84.3617 },
  'Sandy Springs':{ lat: 33.9245, lon: -84.3785 },
  'Valdosta':     { lat: 30.8327, lon: -83.2785 }
};

function getCoords(address) {
  const city = address.split(',')[0].trim();
  return GEORGIA_COORDS[city] || GEORGIA_COORDS['Atlanta'];
}

function todayString() {
  return new Date().toISOString().split('T')[0];
}

// ─── Run one monitoring cycle ─────────────────────────────────────────────────

async function runMonitoringCycle({ sendSlack, logSheets } = {}) {
  const sites = registry.getAll();
  const date = todayString();

  if (sites.length === 0) {
    console.log('[Monitor] No registered sites to check.');
    return;
  }

  console.log(`[Monitor] Starting autonomous check for ${sites.length} site(s) on ${date}`);

  const results = [];

  for (const site of sites) {
    // Only check sites that have a pour scheduled today (or always check if no dates specified)
    const hasPourToday = site.pourDates.length === 0 || site.pourDates.includes(date);
    if (!hasPourToday) continue;

    console.log(`[Monitor]  → Checking: ${site.label}`);
    try {
      const coords = getCoords(site.address);
      const assessment = await runRiskAgent({
        siteAddress: site.address,
        latitude:    coords.lat,
        longitude:   coords.lon,
        date
      });

      const result = { site, date, ...assessment };
      results.push(result);

      // Fire-and-forget notifications
      if (sendSlack) await sendSlack(result).catch(e => console.error('[Monitor] Slack error:', e.message));
      if (logSheets) await logSheets(result).catch(e => console.error('[Monitor] Sheets error:', e.message));

      console.log(`[Monitor]    Risk: ${assessment.riskLevel} — ${assessment.summary?.slice(0, 80)}...`);
    } catch (err) {
      console.error(`[Monitor] Error assessing ${site.label}:`, err.message);
    }
  }

  console.log(`[Monitor] Cycle complete. Assessed ${results.length} site(s).`);
  return results;
}

// ─── Scheduler (no external dependency — pure Node.js) ───────────────────────

/**
 * Schedule the monitoring cycle to run daily at a target hour (default: 6am).
 * Uses setTimeout recursively so it always fires at the right wall-clock time.
 */
function scheduleDailyMonitoring({ targetHour = 6, callbacks = {} } = {}) {
  function msUntilNextRun() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(targetHour, 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1); // already past today's window
    return next - now;
  }

  function scheduleNext() {
    const delay = msUntilNextRun();
    const nextRun = new Date(Date.now() + delay);
    console.log(`[Monitor] Next autonomous check scheduled for ${nextRun.toLocaleString()}`);

    setTimeout(async () => {
      await runMonitoringCycle(callbacks);
      scheduleNext(); // reschedule for the following day
    }, delay);
  }

  scheduleNext();
  console.log(`[Monitor] Autonomous monitoring active — runs daily at ${targetHour}:00`);
}

module.exports = { scheduleDailyMonitoring, runMonitoringCycle };
