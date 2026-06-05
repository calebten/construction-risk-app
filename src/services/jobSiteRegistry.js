/**
 * Job Site Registry
 * Stores sites that the monitoring agent checks automatically each morning.
 * Persists to a JSON file so registered sites survive server restarts.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, '../../data/job-sites.json');

// Ensure the data directory exists
function ensureDataDir() {
  const dir = path.dirname(REGISTRY_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load() {
  ensureDataDir();
  if (!fs.existsSync(REGISTRY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function save(sites) {
  ensureDataDir();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(sites, null, 2));
}

const registry = {
  /** Return all registered sites */
  getAll() {
    return load();
  },

  /** Add a site. Returns the new site object. */
  add({ address, label, pourDates = [] }) {
    const sites = load();
    const existing = sites.find(s => s.address.toLowerCase() === address.toLowerCase());
    if (existing) return existing;

    const site = {
      id: Date.now().toString(),
      address,
      label: label || address,
      pourDates,          // optional list of scheduled pour dates to monitor
      addedAt: new Date().toISOString()
    };

    sites.push(site);
    save(sites);
    return site;
  },

  /** Remove a site by id */
  remove(id) {
    const sites = load().filter(s => s.id !== id);
    save(sites);
  },

  /** Update pour dates for a site */
  updatePourDates(id, pourDates) {
    const sites = load();
    const site = sites.find(s => s.id === id);
    if (site) {
      site.pourDates = pourDates;
      save(sites);
    }
    return site;
  }
};

module.exports = registry;
