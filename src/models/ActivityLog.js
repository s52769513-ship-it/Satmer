module.exports = (sequelize, DataTypes) => {
  const ActivityLog = sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Action performed (e.g., "extension_1_activity_update", "extension_2_completion_update")',
    },
    extension: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Which extension was used (1, 2, or 3)',
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'incomplete'),
      defaultValue: 'success',
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional details about the action',
    },
    callDuration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Duration of call in seconds',
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'activity_logs',
    underscored: true,
    indexes: [
      { fields: ['userId', 'createdAt'] },
      { fields: ['action'] },
      { fields: ['extension'] },
    ],
  });

  ActivityLog.associate = (models) => {
    ActivityLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ActivityLog;
};
