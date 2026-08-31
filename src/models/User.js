module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    idNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      comment: 'Israeli ID number',
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('user', 'admin'),
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    notificationDay: {
      type: DataTypes.ENUM('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'),
      allowNull: true,
      comment: 'Day for weekly notification',
    },
    notificationHour: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, max: 23 },
      comment: 'Hour for weekly notification (0-23)',
    },
    lastActivityUpdate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'When user last updated activity this week',
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
    tableName: 'users',
    underscored: true,
  });

  User.associate = (models) => {
    User.hasMany(models.Activity, { foreignKey: 'userId', as: 'activities' });
    User.hasMany(models.Completion, { foreignKey: 'userId', as: 'completions' });
    User.hasMany(models.UserNotification, { foreignKey: 'userId', as: 'notifications' });
    User.hasMany(models.ActivityLog, { foreignKey: 'userId', as: 'logs' });
  };

  return User;
};
