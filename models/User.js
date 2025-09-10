module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50]
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    role: {
      type: DataTypes.ENUM('admin', 'cashier', 'manager'),
      defaultValue: 'cashier',
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    perm_products: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    perm_categories: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    perm_raw_materials: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    perm_transactions: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    perm_users: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    perm_settings: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  // Add virtual field for frontend compatibility
  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    values.fullname = values.full_name; // Add alias for frontend
    values._id = values.id; // Add _id alias for frontend
    return values;
  };

  return User;
};

