module.exports = (sequelize, DataTypes) => {
  const Activity = sequelize.define('Activity', {
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
    weekStartDate: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Start date of the week (Saturday/Shabbat)',
    },
    weekNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Week number of the year',
    },
    parashaName: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Torah portion name (Parsha)',
    },
    participated: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Did user participate in chesed activity this week?',
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Points earned for this week',
    },
    recordingUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to recorded activity update',
    },
    notes: {
      type: DataTypes.TEXT,
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
    tableName: 'activities',
    underscored: true,
    indexes: [
      { fields: ['userId', 'weekStartDate'], unique: true },
      { fields: ['weekNumber'] },
    ],
  });

  Activity.associate = (models) => {
    Activity.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Activity;
};
