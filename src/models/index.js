const Sequelize = require('sequelize');
const path = require('path');
require('dotenv').config();

const config = require('../config/database')[process.env.NODE_ENV || 'development'];

const sequelize = config.use_env_variable
  ? new Sequelize(process.env[config.use_env_variable], config)
  : new Sequelize(config.database, config.username, config.password, config);

const db = {
  sequelize,
  Sequelize,
  User: require('./User')(sequelize, Sequelize),
  Activity: require('./Activity')(sequelize, Sequelize),
  Completion: require('./Completion')(sequelize, Sequelize),
  UserNotification: require('./UserNotification')(sequelize, Sequelize),
  ActivityLog: require('./ActivityLog')(sequelize, Sequelize),
};

// Define relationships
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

module.exports = db;
