module.exports = (sequelize, DataTypes) => {
  const UserNotification = sequelize.define('UserNotification', {
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
    type: {
      type: DataTypes.ENUM('weekly_reminder', 'achievement', 'admin_message'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    readAt: {
      type: DataTypes.DATE,
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
    tableName: 'user_notifications',
    underscored: true,
    indexes: [
      { fields: ['userId', 'isRead'] },
      { fields: ['createdAt'] },
    ],
  });

  UserNotification.associate = (models) => {
    UserNotification.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return UserNotification;
};
