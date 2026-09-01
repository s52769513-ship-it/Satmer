module.exports = (sequelize, DataTypes) => {
  const Completion = sequelize.define('Completion', {
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
    completionNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Sequential completion number for the year',
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 12 },
      comment: 'Gregorian month of completion (1-12), used for the monthly-update-limit check',
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Gregorian year',
    },
    hebrewMonth: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Hebrew month name (e.g. תשרי), for Hebrew-calendar reporting',
    },
    hebrewYear: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Hebrew year (e.g. 5786), for Hebrew-calendar reporting',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Description of the completion',
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: 'Points earned for this completion',
    },
    recordingUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to recorded completion update',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    tableName: 'completions',
    underscored: true,
    indexes: [
      { fields: ['user_id', 'year', 'month'] },
      { fields: ['user_id', 'completion_number'] },
      { fields: ['hebrew_year', 'hebrew_month'] },
    ],
  });

  Completion.associate = (models) => {
    Completion.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Completion;
};
