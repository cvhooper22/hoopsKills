// One place that decides how a team is labelled in exported JSON (meta/teams.json and each game's
// .meta.json). The teams table only holds what ingest knew (BYU has an abbreviation, opponents do not);
// the hand-kept config/team-labels.json fills in abbrev / shortName, and config/team-colors.json the colour.
const fs = require('fs');
const path = require('path');
const { teamColor } = require('./teamColor');

const LOGOS = path.join(__dirname, '../../assets/logos');
const LABELS = path.join(__dirname, '../../config/team-labels.json');

const loadLabels = () => (fs.existsSync(LABELS) ? JSON.parse(fs.readFileSync(LABELS, 'utf8')) : {});

// row: { team_id, name, abbrev } from the teams table.
function teamLabel(row, labels = loadLabels()) {
  const label = labels[row.team_id] || {};
  return {
    name: row.name,
    abbrev: label.abbrev || row.abbrev || null,
    shortName: label.shortName || row.name,
    logoKey: fs.existsSync(path.join(LOGOS, `${row.team_id}.png`)) ? row.team_id : null,
    color: teamColor(row.team_id), // null when no usable colour (the app falls back to slate)
  };
}

module.exports = { teamLabel, loadLabels };
