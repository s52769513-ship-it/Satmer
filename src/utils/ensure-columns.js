/**
 * Adds columns that don't exist yet on an already-created table.
 *
 * `sequelize.sync()` only runs with `alter: true` in development (see
 * app.js) - in production it's `CREATE TABLE IF NOT EXISTS`, which never
 * touches a table that already exists. That's deliberate (an automatic
 * `alter` on every boot is not something to run against a live production
 * table), but it also means a new column added to a model here needs an
 * explicit, safe migration step, or it silently never appears on Railway's
 * existing database. This is that step: idempotent, additive only, run
 * unconditionally before sync so it's safe to call on every startup.
 */
async function ensureColumns(sequelize, tableName, columns) {
  const queryInterface = sequelize.getQueryInterface();
  const existing = await queryInterface.describeTable(tableName).catch(() => null);
  if (!existing) return; // table doesn't exist yet - sync() will create it with all columns

  for (const [columnName, definition] of Object.entries(columns)) {
    if (!existing[columnName]) {
      await queryInterface.addColumn(tableName, columnName, definition);
      console.log(`✅ Added column ${tableName}.${columnName}`);
    }
  }
}

module.exports = ensureColumns;
